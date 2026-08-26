from __future__ import annotations

import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Optional


# ============================================================
# NEO v1
# NeoCloud Local Avatar Rendering Pipeline
#
# Current renderer:
#   SadTalker CPU
#
# Future renderers:
#   LivePortrait
#   MuseTalk
#   NEO proprietary models
# ============================================================


class NEOAvatarPipeline:
    """
    NEO v1 avatar rendering pipeline.

    Input:
        portrait image
        audio file

    Output:
        talking-avatar MP4

    Current backend renderer:
        SadTalker

    This class intentionally keeps the renderer isolated so
    NeoCloud can replace or combine models later without
    changing the main API architecture.
    """

    def __init__(self, base_dir: Optional[Path] = None):
        if base_dir is None:
            base_dir = Path(__file__).resolve().parent.parent

        self.base_dir = Path(base_dir).resolve()

        self.models_dir = self.base_dir / "models"
        self.output_dir = self.base_dir / "output"

        self.sadtalker_dir = (
            self.models_dir /
            "SadTalker"
        )

        self.sadtalker_python = (
            self.base_dir /
            ".sadtalker-venv" /
            "Scripts" /
            "python.exe"
        )

        self.sadtalker_inference = (
            self.sadtalker_dir /
            "inference.py"
        )

        self.sadtalker_checkpoints = (
            self.sadtalker_dir /
            "checkpoints"
        )

        self.temp_dir = (
            self.base_dir /
            "temp"
        )

        self.temp_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        self.output_dir.mkdir(
            parents=True,
            exist_ok=True,
        )


    # ========================================================
    # Engine Status
    # ========================================================

    def status(self) -> dict:
        return {
            "model": "NEO",
            "version": "v1",
            "renderer": "SadTalker",
            "mode": "local-cpu",

            "sadtalker_installed":
                self.sadtalker_dir.exists(),

            "python_ready":
                self.sadtalker_python.exists(),

            "inference_ready":
                self.sadtalker_inference.exists(),

            "checkpoints_ready":
                self.sadtalker_checkpoints.exists(),

            "ready":
                self.is_ready(),
        }


    def is_ready(self) -> bool:
        return all([
            self.sadtalker_dir.exists(),
            self.sadtalker_python.exists(),
            self.sadtalker_inference.exists(),
            self.sadtalker_checkpoints.exists(),
        ])


    # ========================================================
    # Validation
    # ========================================================

    def validate(self):
        if not self.sadtalker_dir.exists():
            raise RuntimeError(
                "SadTalker folder is missing. "
                "Run setup_sadtalker.ps1 first."
            )

        if not self.sadtalker_python.exists():
            raise RuntimeError(
                "SadTalker Python environment is missing."
            )

        if not self.sadtalker_inference.exists():
            raise RuntimeError(
                "SadTalker inference.py was not found."
            )

        if not self.sadtalker_checkpoints.exists():
            raise RuntimeError(
                "SadTalker checkpoints folder is missing."
            )


    # ========================================================
    # FFmpeg Detection
    # ========================================================

    def find_ffmpeg(self) -> str:
        """
        Find FFmpeg on Windows.

        First tries PATH.
        Then checks common WinGet locations.
        """

        found = shutil.which("ffmpeg")

        if found:
            return found

        possible_roots = [
            Path.home() /
            "AppData" /
            "Local" /
            "Microsoft" /
            "WinGet" /
            "Packages",

            Path(
                r"C:\Program Files"
            ),

            Path(
                r"C:\Program Files (x86)"
            ),
        ]

        for root in possible_roots:
            if not root.exists():
                continue

            try:
                for ffmpeg in root.rglob(
                    "ffmpeg.exe"
                ):
                    if ffmpeg.is_file():
                        return str(ffmpeg)

            except PermissionError:
                continue

        raise RuntimeError(
            "FFmpeg was not found. "
            "Restart VS Code first. "
            "If it still fails, reinstall FFmpeg."
        )


    # ========================================================
    # Audio Conversion
    # ========================================================

    def prepare_audio(
        self,
        audio_path: Path,
        job_id: str,
    ) -> Path:
        """
        SadTalker behaves most consistently with WAV input.

        NeoCloud users may upload:
            M4A
            MP3
            WAV
            MP4 audio

        Everything is converted to:
            mono
            16 kHz
            PCM WAV
        """

        audio_path = Path(audio_path).resolve()

        if not audio_path.exists():
            raise FileNotFoundError(
                f"Audio file not found: {audio_path}"
            )

        job_temp = (
            self.temp_dir /
            job_id
        )

        job_temp.mkdir(
            parents=True,
            exist_ok=True,
        )

        wav_path = (
            job_temp /
            "neo_audio.wav"
        )

        ffmpeg = self.find_ffmpeg()

        command = [
            ffmpeg,

            "-y",

            "-i",
            str(audio_path),

            "-vn",

            "-ac",
            "1",

            "-ar",
            "16000",

            "-acodec",
            "pcm_s16le",

            str(wav_path),
        ]

        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            errors="replace",
        )

        if result.returncode != 0:
            raise RuntimeError(
                "Audio conversion failed.\n\n"
                + result.stderr[-3000:]
            )

        if not wav_path.exists():
            raise RuntimeError(
                "FFmpeg finished but WAV file was not created."
            )

        return wav_path


    # ========================================================
    # Find Rendered Video
    # ========================================================

    def find_latest_mp4(
        self,
        directory: Path,
        created_after: float,
    ) -> Optional[Path]:

        candidates = []

        for mp4 in directory.rglob("*.mp4"):
            try:
                modified = mp4.stat().st_mtime

                if modified >= created_after - 2:
                    candidates.append(
                        (
                            modified,
                            mp4,
                        )
                    )

            except OSError:
                continue

        if not candidates:
            return None

        candidates.sort(
            key=lambda item: item[0],
            reverse=True,
        )

        return candidates[0][1]


    # ========================================================
    # SadTalker Renderer
    # ========================================================

    def render_sadtalker(
        self,
        portrait_path: Path,
        audio_path: Path,
        job_id: str,
        preprocess: str = "full",
        still: bool = True,
    ) -> Path:

        self.validate()

        portrait_path = Path(
            portrait_path
        ).resolve()

        audio_path = Path(
            audio_path
        ).resolve()

        if not portrait_path.exists():
            raise FileNotFoundError(
                f"Portrait file not found: {portrait_path}"
            )

        if not audio_path.exists():
            raise FileNotFoundError(
                f"Audio file not found: {audio_path}"
            )

        # ----------------------------------------------------
        # Convert user's audio to WAV
        # ----------------------------------------------------

        prepared_audio = (
            self.prepare_audio(
                audio_path,
                job_id,
            )
        )

        # ----------------------------------------------------
        # NEO output folder
        # ----------------------------------------------------

        neo_job_output = (
            self.output_dir /
            job_id
        )

        neo_job_output.mkdir(
            parents=True,
            exist_ok=True,
        )

        # SadTalker creates its own timestamp output.
        sadtalker_result_dir = (
            neo_job_output /
            "sadtalker"
        )

        sadtalker_result_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        # ----------------------------------------------------
        # Build inference command
        # ----------------------------------------------------

        command = [
            str(
                self.sadtalker_python
            ),

            str(
                self.sadtalker_inference
            ),

            "--driven_audio",
            str(
                prepared_audio
            ),

            "--source_image",
            str(
                portrait_path
            ),

            "--result_dir",
            str(
                sadtalker_result_dir
            ),

            "--checkpoint_dir",
            str(
                self.sadtalker_checkpoints
            ),

            "--preprocess",
            preprocess,

            "--cpu",
        ]

        if still:
            command.append(
                "--still"
            )

        # ----------------------------------------------------
        # Start render
        # ----------------------------------------------------

        started_at = time.time()

        print("")
        print(
            "======================================="
        )
        print(
            " NEO v1 AVATAR RENDER STARTED"
        )
        print(
            "======================================="
        )
        print(
            f"Job: {job_id}"
        )
        print(
            f"Portrait: {portrait_path}"
        )
        print(
            f"Audio: {prepared_audio}"
        )
        print(
            "Renderer: SadTalker CPU"
        )
        print(
            "This may take time on a CPU-only PC."
        )
        print("")

        result = subprocess.run(
            command,

            cwd=str(
                self.sadtalker_dir
            ),

            stdout=subprocess.PIPE,

            stderr=subprocess.STDOUT,

            text=True,

            errors="replace",
        )

        print(
            result.stdout
        )

        if result.returncode != 0:
            raise RuntimeError(
                "SadTalker rendering failed.\n\n"
                + result.stdout[-6000:]
            )

        # ----------------------------------------------------
        # Locate generated MP4
        # ----------------------------------------------------

        rendered_video = (
            self.find_latest_mp4(
                sadtalker_result_dir,
                started_at,
            )
        )

        if rendered_video is None:
            raise RuntimeError(
                "SadTalker finished but no generated "
                "MP4 video was found."
            )

        # ----------------------------------------------------
        # Copy to clean NeoCloud filename
        # ----------------------------------------------------

        final_output = (
            neo_job_output /
            "neo_avatar.mp4"
        )

        shutil.copy2(
            rendered_video,
            final_output,
        )

        if not final_output.exists():
            raise RuntimeError(
                "NEO final video could not be created."
            )

        print("")
        print(
            "======================================="
        )
        print(
            " NEO v1 AVATAR RENDER COMPLETE"
        )
        print(
            "======================================="
        )
        print(
            f"Video: {final_output}"
        )
        print("")

        return final_output


    # ========================================================
    # Main NEO Renderer
    # ========================================================

    def render(
        self,
        portrait_path: Path,
        audio_path: Path,
        job_id: str,
        motion_style: str = "natural",
    ) -> dict:
        """
        Main entry point for NeoCloud.

        Future versions can route between:

            SadTalker
            LivePortrait
            MuseTalk
            NEO proprietary renderer

        without changing the public API.
        """

        started = time.time()

        try:

            final_video = (
                self.render_sadtalker(
                    portrait_path=
                        portrait_path,

                    audio_path=
                        audio_path,

                    job_id=
                        job_id,

                    preprocess=
                        "full",

                    still=
                        True,
                )
            )

            elapsed = (
                time.time()
                - started
            )

            return {
                "success": True,

                "model": "NEO",

                "version": "v1",

                "renderer":
                    "SadTalker",

                "job_id":
                    job_id,

                "status":
                    "ready",

                "video_path":
                    str(
                        final_video
                    ),

                "render_seconds":
                    round(
                        elapsed,
                        2,
                    ),
            }

        except Exception as error:

            elapsed = (
                time.time()
                - started
            )

            return {
                "success": False,

                "model": "NEO",

                "version": "v1",

                "renderer":
                    "SadTalker",

                "job_id":
                    job_id,

                "status":
                    "failed",

                "error":
                    str(
                        error
                    ),

                "render_seconds":
                    round(
                        elapsed,
                        2,
                    ),
            }


# ============================================================
# Shared NEO Pipeline Instance
# ============================================================

neo_avatar_pipeline = NEOAvatarPipeline()


# ============================================================
# Local Developer Test
# ============================================================

if __name__ == "__main__":

    print("")
    print(
        "NEO v1 Avatar Pipeline"
    )
    print(
        "Engine status:"
    )
    print(
        neo_avatar_pipeline.status()
    )