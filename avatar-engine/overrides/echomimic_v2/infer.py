import argparse
import os
import random
from pathlib import Path

import numpy as np
import torch
from diffusers import AutoencoderKL, DDIMScheduler
from omegaconf import OmegaConf
from PIL import Image, ImageFilter

from src.models.unet_2d_condition import UNet2DConditionModel
from src.models.unet_3d_emo import EMOUNet3DConditionModel
from src.models.whisper.audio2feature import load_audio_model
from src.pipelines.pipeline_echomimicv2 import EchoMimicV2Pipeline
from src.utils.util import save_videos_grid
from src.models.pose_encoder import PoseEncoder
from src.utils.dwpose_util import draw_pose_select_v2

from moviepy.editor import VideoFileClip, AudioFileClip


# ============================================================
# FFMPEG
# ============================================================

ffmpeg_path = os.getenv("FFMPEG_PATH")

if ffmpeg_path is None:
    print(
        "please download ffmpeg-static and export to FFMPEG_PATH.\n"
        "For example: export FFMPEG_PATH=./ffmpeg-4.4-amd64-static"
    )
elif ffmpeg_path not in os.getenv("PATH", ""):
    print("add ffmpeg to path")
    os.environ["PATH"] = f"{ffmpeg_path}:{os.environ.get('PATH', '')}"


# ============================================================
# ARGUMENTS
# ============================================================

def parse_args():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--config",
        type=str,
        default="./configs/prompts/infer.yaml",
    )

    parser.add_argument("-W", type=int, default=768)
    parser.add_argument("-H", type=int, default=768)
    parser.add_argument("-L", type=int, default=240)

    parser.add_argument("--seed", type=int, default=3407)

    parser.add_argument("--context_frames", type=int, default=12)
    parser.add_argument("--context_overlap", type=int, default=3)

    parser.add_argument("--cfg", type=float, default=2.5)
    parser.add_argument("--steps", type=int, default=30)

    parser.add_argument("--sample_rate", type=int, default=16000)
    parser.add_argument("--fps", type=int, default=24)

    parser.add_argument("--device", type=str, default="cuda")

    parser.add_argument(
        "--ref_images_dir",
        type=str,
        default="./assets/halfbody_demo/refimag",
    )

    parser.add_argument(
        "--audio_dir",
        type=str,
        default="./assets/halfbody_demo/audio",
    )

    parser.add_argument(
        "--pose_dir",
        type=str,
        default="./assets/halfbody_demo/pose",
    )

    parser.add_argument(
        "--refimg_name",
        type=str,
        default="natural_bk_openhand/0035.png",
    )

    parser.add_argument(
        "--audio_name",
        type=str,
        default="chinese/echomimicv2_woman.wav",
    )

    parser.add_argument(
        "--pose_name",
        type=str,
        default="01",
    )

    return parser.parse_args()


# ============================================================
# REFERENCE IMAGE PREPARATION
# ============================================================

def prepare_reference_image(image_path, target_width, target_height):
    """
    Prepare the portrait without stretching the face.

    The old implementation directly resized every image to W x H.
    That can distort facial geometry when the source aspect ratio
    is different from the generation resolution.
    """

    image = Image.open(image_path).convert("RGB")

    src_w, src_h = image.size

    if src_w <= 0 or src_h <= 0:
        raise ValueError("Invalid reference image dimensions.")

    scale = max(
        target_width / src_w,
        target_height / src_h,
    )

    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))

    image = image.resize(
        (new_w, new_h),
        Image.Resampling.LANCZOS,
    )

    left = max(0, (new_w - target_width) // 2)
    top = max(0, (new_h - target_height) // 2)

    image = image.crop(
        (
            left,
            top,
            left + target_width,
            top + target_height,
        )
    )

    # Mild sharpening only.
    # Heavy sharpening often makes diffusion facial artifacts worse.
    image = image.filter(
        ImageFilter.UnsharpMask(
            radius=1.0,
            percent=105,
            threshold=3,
        )
    )

    return image


# ============================================================
# POSE PREPARATION
# ============================================================

def build_pose_tensor(
    pose_path,
    start_idx,
    total_frames,
    width,
    height,
    weight_dtype,
    device,
):
    """
    Build pose frames safely.

    Important changes:
    - Correct canvas shape: H x W x 3
    - Resize pose output into its target bounding box
    - Clamp coordinates
    - Mild temporal smoothing to reduce sudden jitter
    """

    pose_list = []

    previous_pose = None

    # 1.0 = no smoothing
    # Lower = smoother but too low may cause ghosting.
    pose_alpha = 0.70

    for index in range(start_idx, start_idx + total_frames):

        target_pose = np.zeros(
            (height, width, 3),
            dtype=np.uint8,
        )

        pose_file = os.path.join(
            pose_path,
            f"{index}.npy",
        )

        if not os.path.exists(pose_file):
            raise FileNotFoundError(
                f"Pose frame not found: {pose_file}"
            )

        detected_pose = np.load(
            pose_file,
            allow_pickle=True,
        ).tolist()

        (
            imh_new,
            imw_new,
            rb,
            re,
            cb,
            ce,
        ) = detected_pose["draw_pose_params"]

        pose_image = draw_pose_select_v2(
            detected_pose,
            imh_new,
            imw_new,
            ref_w=800,
        )

        pose_image = np.transpose(
            np.array(pose_image),
            (1, 2, 0),
        )

        # ----------------------------------------------------
        # Safe target coordinates
        # ----------------------------------------------------

        rb = int(rb)
        re = int(re)
        cb = int(cb)
        ce = int(ce)

        original_region_h = max(1, re - rb)
        original_region_w = max(1, ce - cb)

        # Resize rendered pose to the exact intended region.
        pose_image = Image.fromarray(
            pose_image.astype(np.uint8)
        ).resize(
            (
                original_region_w,
                original_region_h,
            ),
            Image.Resampling.BILINEAR,
        )

        pose_image = np.array(pose_image)

        # Clamp to output canvas.
        safe_rb = max(0, rb)
        safe_re = min(height, re)

        safe_cb = max(0, cb)
        safe_ce = min(width, ce)

        valid_h = safe_re - safe_rb
        valid_w = safe_ce - safe_cb

        if valid_h > 0 and valid_w > 0:

            # Offset if original box begins outside canvas.
            source_y = max(0, safe_rb - rb)
            source_x = max(0, safe_cb - cb)

            pose_crop = pose_image[
                source_y:source_y + valid_h,
                source_x:source_x + valid_w,
                :,
            ]

            actual_h = min(
                valid_h,
                pose_crop.shape[0],
            )

            actual_w = min(
                valid_w,
                pose_crop.shape[1],
            )

            if actual_h > 0 and actual_w > 0:
                target_pose[
                    safe_rb:safe_rb + actual_h,
                    safe_cb:safe_cb + actual_w,
                    :,
                ] = pose_crop[
                    :actual_h,
                    :actual_w,
                    :,
                ]

        # ----------------------------------------------------
        # Mild temporal pose smoothing
        # ----------------------------------------------------

        current_pose = target_pose.astype(np.float32)

        if previous_pose is not None:
            current_pose = (
                pose_alpha * current_pose
                + (1.0 - pose_alpha) * previous_pose
            )

        previous_pose = current_pose.copy()

        current_pose = np.clip(
            current_pose,
            0,
            255,
        ).astype(np.uint8)

        pose_tensor = (
            torch.from_numpy(current_pose)
            .to(
                dtype=weight_dtype,
                device=device,
            )
            .permute(2, 0, 1)
            / 255.0
        )

        pose_list.append(pose_tensor)

    if len(pose_list) == 0:
        raise RuntimeError(
            "No pose frames were generated."
        )

    poses_tensor = torch.stack(
        pose_list,
        dim=1,
    ).unsqueeze(0)

    return poses_tensor


# ============================================================
# MAIN
# ============================================================

def main():

    args = parse_args()

    # --------------------------------------------------------
    # Configuration
    # --------------------------------------------------------

    config = OmegaConf.load(args.config)

    if config.weight_dtype == "fp16":
        weight_dtype = torch.float16
    else:
        weight_dtype = torch.float32

    device = args.device

    if "cuda" in device and not torch.cuda.is_available():
        print(
            "CUDA requested but unavailable. Falling back to CPU."
        )
        device = "cpu"

        # CPU generally cannot use fp16 safely for many operations.
        if weight_dtype == torch.float16:
            weight_dtype = torch.float32

    inference_config_path = config.inference_config

    infer_config = OmegaConf.load(
        inference_config_path
    )

    # --------------------------------------------------------
    # Output directory
    # --------------------------------------------------------

    motion_parent = Path(
        config.motion_module_path
    ).parent.name

    motion_filename = Path(
        config.motion_module_path
    ).stem

    model_flag = (
        f"{motion_parent}-{motion_filename}"
    )

    save_dir = Path(
        f"outputs/{model_flag}-seed{args.seed}"
    )

    save_dir.mkdir(
        exist_ok=True,
        parents=True,
    )

    print("Output directory:", save_dir)

    # ========================================================
    # MODEL INITIALIZATION
    # ========================================================

    print("Initializing NEO V2 / EchoMimic models...")

    # --------------------------------------------------------
    # VAE
    # --------------------------------------------------------

    vae = AutoencoderKL.from_pretrained(
        config.pretrained_vae_path,
    ).to(
        device=device,
        dtype=weight_dtype,
    )

    # --------------------------------------------------------
    # Reference UNet
    # --------------------------------------------------------

    reference_unet = (
        UNet2DConditionModel.from_pretrained(
            config.pretrained_base_model_path,
            subfolder="unet",
        )
        .to(
            dtype=weight_dtype,
            device=device,
        )
    )

    reference_unet.load_state_dict(
        torch.load(
            config.reference_unet_path,
            map_location="cpu",
        )
    )

    # --------------------------------------------------------
    # Denoising UNet
    # --------------------------------------------------------

    if os.path.exists(
        config.motion_module_path
    ):
        print("using motion module")
    else:
        raise FileNotFoundError(
            f"Motion module not found: "
            f"{config.motion_module_path}"
        )

    denoising_unet = (
        EMOUNet3DConditionModel.from_pretrained_2d(
            config.pretrained_base_model_path,
            config.motion_module_path,
            subfolder="unet",
            unet_additional_kwargs=(
                infer_config.unet_additional_kwargs
            ),
        )
        .to(
            dtype=weight_dtype,
            device=device,
        )
    )

    denoising_unet.load_state_dict(
        torch.load(
            config.denoising_unet_path,
            map_location="cpu",
        ),
        strict=False,
    )

    # --------------------------------------------------------
    # Pose Encoder
    # --------------------------------------------------------

    pose_net = PoseEncoder(
        320,
        conditioning_channels=3,
        block_out_channels=(
            16,
            32,
            96,
            256,
        ),
    ).to(
        dtype=weight_dtype,
        device=device,
    )

    pose_net.load_state_dict(
        torch.load(
            config.pose_encoder_path,
            map_location="cpu",
        )
    )

    # --------------------------------------------------------
    # Audio Processor
    # --------------------------------------------------------

    audio_processor = load_audio_model(
        model_path=config.audio_model_path,
        device=device,
    )

    print("Model initialization complete.")

    # ========================================================
    # PIPELINE
    # ========================================================

    width = args.W
    height = args.H

    sched_kwargs = OmegaConf.to_container(
        infer_config.noise_scheduler_kwargs
    )

    scheduler = DDIMScheduler(
        **sched_kwargs
    )

    pipe = EchoMimicV2Pipeline(
        vae=vae,
        reference_unet=reference_unet,
        denoising_unet=denoising_unet,
        audio_guider=audio_processor,
        pose_encoder=pose_net,
        scheduler=scheduler,
    )

    pipe = pipe.to(
        device,
        dtype=weight_dtype,
    )

    # ========================================================
    # RANDOM SEED
    # ========================================================

    if args.seed is not None and args.seed > -1:
        generator = torch.manual_seed(
            args.seed
        )
    else:
        generator = torch.manual_seed(
            random.randint(
                100,
                1_000_000,
            )
        )

    final_fps = args.fps

    # ========================================================
    # INPUT PATHS
    # ========================================================

    ref_images_dir = args.ref_images_dir
    audio_dir = args.audio_dir
    pose_dir = args.pose_dir

    refimg_name = args.refimg_name
    audio_name = args.audio_name
    pose_name = args.pose_name

    inputs_dict = {
        "refimg": os.path.join(
            ref_images_dir,
            refimg_name,
        ),
        "audio": os.path.join(
            audio_dir,
            audio_name,
        ),
        "pose": os.path.join(
            pose_dir,
            pose_name,
        ),
    }

    start_idx = 0

    print(
        "Pose:",
        inputs_dict["pose"],
    )

    print(
        "Reference:",
        inputs_dict["refimg"],
    )

    print(
        "Audio:",
        inputs_dict["audio"],
    )

    # --------------------------------------------------------
    # Validate inputs
    # --------------------------------------------------------

    if not os.path.isfile(
        inputs_dict["refimg"]
    ):
        raise FileNotFoundError(
            f"Reference image not found: "
            f"{inputs_dict['refimg']}"
        )

    if not os.path.isfile(
        inputs_dict["audio"]
    ):
        raise FileNotFoundError(
            f"Audio file not found: "
            f"{inputs_dict['audio']}"
        )

    if not os.path.isdir(
        inputs_dict["pose"]
    ):
        raise FileNotFoundError(
            f"Pose directory not found: "
            f"{inputs_dict['pose']}"
        )

    # ========================================================
    # OUTPUT FILE NAME
    # ========================================================

    ref_path = Path(refimg_name)

    if len(ref_path.parts) >= 2:
        ref_flag = (
            f"{ref_path.parts[-2]}."
            f"{ref_path.parts[-1]}"
        )
    else:
        ref_flag = ref_path.name

    save_path = (
        save_dir
        / ref_flag
        / pose_name
    )

    save_path.mkdir(
        exist_ok=True,
        parents=True,
    )

    ref_s = Path(
        refimg_name
    ).stem

    audio_s = Path(
        audio_name
    ).stem

    save_name = str(
        save_path
        / f"{ref_s}-a-{audio_s}-i{start_idx}"
    )

    # ========================================================
    # REFERENCE IMAGE
    # ========================================================

    print(
        "Preparing high-quality reference image..."
    )

    ref_image_pil = prepare_reference_image(
        inputs_dict["refimg"],
        args.W,
        args.H,
    )

    # ========================================================
    # AUDIO + FRAME LENGTH
    # ========================================================

    audio_clip = AudioFileClip(
        inputs_dict["audio"]
    )

    pose_frame_files = [
        name
        for name in os.listdir(
            inputs_dict["pose"]
        )
        if name.endswith(".npy")
    ]

    available_pose_frames = len(
        pose_frame_files
    )

    audio_frames = int(
        audio_clip.duration
        * final_fps
    )

    args.L = min(
        args.L,
        audio_frames,
        available_pose_frames,
    )

    if args.L <= 0:
        audio_clip.close()

        raise RuntimeError(
            "Generation length is zero. "
            "Check audio duration and pose frames."
        )

    print(
        f"NEO V2 generation settings | "
        f"frames={args.L} | "
        f"fps={final_fps} | "
        f"steps={args.steps} | "
        f"cfg={args.cfg} | "
        f"resolution={args.W}x{args.H}"
    )

    # ========================================================
    # POSE TENSOR
    # ========================================================

    print(
        "Preparing stabilized pose sequence..."
    )

    poses_tensor = build_pose_tensor(
        pose_path=inputs_dict["pose"],
        start_idx=start_idx,
        total_frames=args.L,
        width=args.W,
        height=args.H,
        weight_dtype=weight_dtype,
        device=device,
    )

    # ========================================================
    # AUDIO DURATION
    # ========================================================

    audio_clip = audio_clip.set_duration(
        args.L / final_fps
    )

    # ========================================================
    # INFERENCE
    # ========================================================

    print(
        "Starting NEO V2 inference..."
    )

    video = pipe(
        ref_image_pil,
        inputs_dict["audio"],
        poses_tensor[
            :,
            :,
            :args.L,
            ...,
        ],
        width,
        height,
        args.L,
        args.steps,
        args.cfg,
        generator=generator,
        audio_sample_rate=args.sample_rate,
        context_frames=args.context_frames,
        fps=final_fps,
        context_overlap=args.context_overlap,
        start_idx=start_idx,
    ).videos

    # ========================================================
    # FINAL FRAME LENGTH
    # ========================================================

    final_length = min(
        video.shape[2],
        poses_tensor.shape[2],
        args.L,
    )

    video_sig = video[
        :,
        :,
        :final_length,
        :,
        :,
    ]

    # ========================================================
    # SAVE VIDEO WITHOUT AUDIO
    # ========================================================

    temp_video_path = (
        save_name
        + "_woa_sig.mp4"
    )

    final_video_path = (
        save_name
        + "_sig.mp4"
    )

    save_videos_grid(
        video_sig,
        temp_video_path,
        n_rows=1,
        fps=final_fps,
    )

    # ========================================================
    # ADD AUDIO
    # ========================================================

    print(
        "Adding audio to generated video..."
    )

    video_clip_sig = VideoFileClip(
        temp_video_path
    )

    video_clip_sig = (
        video_clip_sig.set_audio(
            audio_clip
        )
    )

    video_clip_sig.write_videofile(
        final_video_path,
        codec="libx264",
        audio_codec="aac",
        threads=2,
    )

    # ========================================================
    # CLEANUP
    # ========================================================

    try:
        video_clip_sig.close()
    except Exception:
        pass

    try:
        audio_clip.close()
    except Exception:
        pass

    try:
        if os.path.exists(
            temp_video_path
        ):
            os.remove(
                temp_video_path
            )
    except Exception as cleanup_error:
        print(
            "Temporary video cleanup warning:",
            cleanup_error,
        )

    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    # ========================================================
    # DONE
    # ========================================================

    print(
        "NEO V2 generation completed."
    )

    print(
        "Final video:",
        final_video_path,
    )


if __name__ == "__main__":
    main()