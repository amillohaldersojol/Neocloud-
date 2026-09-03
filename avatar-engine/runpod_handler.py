import base64
import os
import shutil
import subprocess
import sys
import time
import urllib.request
import uuid
from pathlib import Path

import runpod


# ============================================================
# NeoCloud NEO V2 - EchoMimic V2 RunPod GPU Worker
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_DIR = (
    BASE_DIR
    / "models"
    / "echomimic_v2"
)

INFER_SCRIPT = MODEL_DIR / "infer.py"

TEMP_DIR = BASE_DIR / "temp" / "neo_v2_runpod"
OUTPUT_DIR = BASE_DIR / "output" / "neo_v2"

TEMP_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# Helpers
# ============================================================

def is_url(value: str) -> bool:
    value = str(value).lower()

    return (
        value.startswith("http://")
        or value.startswith("https://")
    )


def download_file(
    url: str,
    destination: Path,
) -> Path:

    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    urllib.request.urlretrieve(
        url,
        destination,
    )

    return destination


def prepare_input_file(
    value: str,
    work_dir: Path,
    default_name: str,
) -> Path:

    work_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    default_suffix = Path(default_name).suffix.lower()

    if is_url(value):

        url_path = value.split("?")[0]
        detected_suffix = Path(url_path).suffix.lower()

        valid_suffixes = {
            ".png",
            ".jpg",
            ".jpeg",
            ".webp",
            ".wav",
            ".mp3",
            ".m4a",
            ".mp4",
            ".aac",
            ".flac",
        }

        if detected_suffix not in valid_suffixes:
            detected_suffix = default_suffix

        destination = (
            work_dir
            / (
                Path(default_name).stem
                + detected_suffix
            )
        )

        return download_file(
            value,
            destination,
        )

    source = Path(value)

    if not source.exists():
        raise FileNotFoundError(
            f"Input file not found: {value}"
        )

    source_suffix = source.suffix.lower()

    if source_suffix:
        destination = (
            work_dir
            / (
                Path(default_name).stem
                + source_suffix
            )
        )
    else:
        destination = (
            work_dir
            / default_name
        )

    shutil.copy2(
        source,
        destination,
    )

    return destination

    source = Path(value)

    if not source.exists():
        raise FileNotFoundError(
            f"Input file not found: {value}"
        )

    destination = (
        work_dir
        / source.name
    )

    shutil.copy2(
        source,
        destination,
    )

    return destination


def find_default_pose_dir() -> Path:

    candidates = [
        MODEL_DIR
        / "assets"
        / "halfbody_demo"
        / "pose"
        / "01",

        MODEL_DIR
        / "assets"
        / "halfbody_demo"
        / "pose",
    ]

    for candidate in candidates:

        if candidate.exists():
            return candidate

    raise FileNotFoundError(
        "EchoMimic V2 demo pose directory was not found."
    )


def newest_video(
    search_root: Path,
    started_at: float,
):

    videos = []

    for extension in (
        "*.mp4",
        "*.mov",
        "*.avi",
    ):

        videos.extend(
            search_root.rglob(extension)
        )

    videos = [
        path
        for path in videos
        if path.stat().st_mtime
        >= started_at - 5
    ]

    if not videos:
        return None

    return max(
        videos,
        key=lambda p: p.stat().st_mtime,
    )


def video_to_base64(
    video_path: Path,
):

    size_mb = (
        video_path.stat().st_size
        / 1024
        / 1024
    )

    # First MVP test only.
    # Avoid returning a massive RunPod JSON payload.
    if size_mb > 20:

        return None, round(
            size_mb,
            2,
        )

    encoded = base64.b64encode(
        video_path.read_bytes()
    ).decode("utf-8")

    return encoded, round(
        size_mb,
        2,
    )


# ============================================================
# Environment check
# ============================================================

def environment_status():

    required = {
        "model_dir":
            MODEL_DIR,

        "infer_script":
            INFER_SCRIPT,

        "denoising_unet":
            MODEL_DIR
            / "pretrained_weights"
            / "denoising_unet.pth",

        "reference_unet":
            MODEL_DIR
            / "pretrained_weights"
            / "reference_unet.pth",

        "pose_encoder":
            MODEL_DIR
            / "pretrained_weights"
            / "pose_encoder.pth",

        "motion_module":
            MODEL_DIR
            / "pretrained_weights"
            / "motion_module.pth",

        "vae":
            MODEL_DIR
            / "pretrained_weights"
            / "sd-vae-ft-mse",

        "image_variation":
            MODEL_DIR
            / "pretrained_weights"
            / "sd-image-variations-diffusers",

        "wav2vec":
            MODEL_DIR
            / "pretrained_weights"
            / "wav2vec2-base-960h",

        "whisper":
            MODEL_DIR
            / "pretrained_weights"
            / "audio_processor"
            / "tiny.pt",
    }

    result = {}

    ready = True

    for name, path in required.items():

        exists = path.exists()

        result[name] = {
            "path": str(path),
            "exists": exists,
        }

        if not exists:
            ready = False

    return ready, result


# ============================================================
# EchoMimic inference
# ============================================================

def run_echomimic(
    source_image: str,
    audio_path: str,
    payload: dict,
):

    ready, files = environment_status()

    if not ready:

        return {
            "success": False,

            "status":
                "model-files-missing",

            "message":
                "EchoMimic V2 is not fully available "
                "inside the RunPod worker.",

            "files":
                files,
        }

    request_id = (
        payload.get("job_id")
        or uuid.uuid4().hex[:12]
    )

    work_dir = (
        TEMP_DIR
        / request_id
    )

    work_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    ref_dir = work_dir / "ref"
    audio_dir = work_dir / "audio"

    ref_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    audio_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    image_file = prepare_input_file(
        source_image,
        ref_dir,
        "reference.png",
    )

    audio_file = prepare_input_file(
        audio_path,
        audio_dir,
        "audio.wav",
    )

    pose_dir = find_default_pose_dir()

    pose_name = (
        payload.get("pose_name")
        or "01"
    )

    fps = int(
        payload.get(
            "fps",
            24,
        )
    )

    width = int(
        payload.get(
            "width",
            768,
        )
    )

    height = int(
        payload.get(
            "height",
            768,
        )
    )

    steps = int(
        payload.get(
            "steps",
            30,
        )
    )

    seed = int(
        payload.get(
            "seed",
            3467,
        )
    )

    command = [
        sys.executable,
        str(INFER_SCRIPT),

        "--config",
        "./configs/prompts/infer.yaml",

        "-W",
        str(width),

        "-H",
        str(height),

        "--seed",
        str(seed),

        "--steps",
        str(steps),

        "--fps",
        str(fps),

        "--device",
        "cuda",

        "--ref_images_dir",
        str(work_dir),

        "--audio_dir",
        str(audio_dir),

        "--pose_dir",
       str(pose_dir.parent),

       "--refimg_name",
f"{ref_dir.name}/{image_file.name}",

        "--audio_name",
        audio_file.name,

        "--pose_name",
        pose_name,
    ]

    started_at = time.time()

    process = subprocess.run(
        command,
        cwd=str(MODEL_DIR),
        capture_output=True,
        text=True,
        timeout=int(
            payload.get(
                "timeout_seconds",
                1800,
            )
        ),
    )

    if process.returncode != 0:

        return {
            "success": False,

            "status":
                "echomimic-inference-failed",

            "return_code":
                process.returncode,

            "stdout":
                process.stdout[-8000:],

            "stderr":
                process.stderr[-8000:],
        }

    generated_video = newest_video(
        MODEL_DIR / "outputs",
        started_at,
    )

    if generated_video is None:

        generated_video = newest_video(
            MODEL_DIR,
            started_at,
        )

    if generated_video is None:

        return {
            "success": False,

            "status":
                "output-video-not-found",

            "stdout":
                process.stdout[-8000:],

            "stderr":
                process.stderr[-8000:],
        }

    final_output = (
        OUTPUT_DIR
        / f"{request_id}.mp4"
    )

    shutil.copy2(
        generated_video,
        final_output,
    )

    encoded_video, size_mb = (
        video_to_base64(
            final_output
        )
    )

    response = {
        "success": True,

        "status":
            "completed",

        "engine":
            "NEO V2 EchoMimic",

        "job_id":
            request_id,

        "video_path":
            str(final_output),

        "video_size_mb":
            size_mb,

        "generation_seconds":
            round(
                time.time()
                - started_at,
                2,
            ),

        "motion_style":
            payload.get(
                "motion_style",
                "natural",
            ),

        "emotion":
            payload.get(
                "emotion",
                "neutral",
            ),
    }

    if encoded_video:

        response[
            "video_base64"
        ] = encoded_video

        response[
            "video_mime_type"
        ] = "video/mp4"

    else:

        response[
            "video_base64"
        ] = None

        response[
            "message"
        ] = (
            "Video generated successfully, "
            "but it is too large to return "
            "inline. Object storage upload "
            "will be added next."
        )

    return response


# ============================================================
# RunPod handler
# ============================================================

def handler(job):

    try:

        payload = (
            job.get("input", {})
            or {}
        )

        # Diagnostic test
        if payload.get(
            "action"
        ) == "health":

            ready, files = (
                environment_status()
            )

            return {
                "success":
                    ready,

                "status":
                    (
                        "ready"
                        if ready
                        else
                        "missing-model-files"
                    ),

                "cuda_visible_devices":
                    os.getenv(
                        "CUDA_VISIBLE_DEVICES"
                    ),

                "files":
                    files,
            }

        source_image = payload.get(
            "source_image"
        )

        audio_path = payload.get(
            "audio_path"
        )

        if (
            not source_image
            or not audio_path
        ):

            return {
                "success": False,

                "status":
                    "missing-input",

                "message":
                    "source_image and audio_path "
                    "are required",
            }

        return run_echomimic(
            source_image=
                source_image,

            audio_path=
                audio_path,

            payload=
                payload,
        )

    except subprocess.TimeoutExpired:

        return {
            "success": False,

            "status":
                "inference-timeout",

            "message":
                "EchoMimic V2 inference exceeded "
                "the allowed runtime.",
        }

    except Exception as exc:

        return {
            "success": False,

            "status":
                "worker-error",

            "error":
                str(exc),

            "error_type":
                type(exc).__name__,
        }


# ============================================================
# Start RunPod serverless worker
# ============================================================

if __name__ == "__main__":

    runpod.serverless.start(
        {
            "handler":
                handler
        }
    )