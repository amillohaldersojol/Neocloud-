from __future__ import annotations

import platform
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional


# ============================================================
# NeoCloud NEO v2 - Body Renderer Gateway
# ============================================================
#
# NEO v1:
#   Portrait + Audio
#       -> SadTalker
#       -> Face / Head / Lip-Sync video
#
# NEO v2:
#   Portrait + Audio
#       -> NEO v1 Face Renderer
#       -> NEO Body Motion Planner
#       -> NEO Body Renderer Gateway
#       -> Upper-body / Hand / Gesture Renderer
#       -> Final Video
#
# IMPORTANT:
# This file does NOT replace SadTalker.
# It creates a safe plug-in layer for future body models.
# ============================================================


@dataclass
class BodyRendererConfig:
    renderer_name: str = "NEO-Body"
    version: str = "v2"
    mode: str = "auto"

    width: int = 512
    height: int = 512
    fps: int = 25

    motion_style: str = "natural"
    emotion: str = "neutral"

    hand_strength: float = 0.50
    torso_strength: float = 0.30
    head_strength: float = 0.30

    use_gpu_if_available: bool = True
    allow_cpu_fallback: bool = True


class NEOBodyRenderer:
    """
    Safe renderer gateway for NEO v2.

    The purpose of this class is to keep the existing NEO v1
    avatar pipeline stable while allowing us to add external
    full-body / upper-body renderers later.

    For now:
        - detects system capabilities
        - validates input/output
        - prepares renderer jobs
        - keeps a passthrough fallback
        - exposes a clean API for future body models
    """

    def __init__(
        self,
        config: Optional[BodyRendererConfig] = None,
    ) -> None:

        self.config = config or BodyRendererConfig()

        self.name = self.config.renderer_name
        self.version = self.config.version

        self.ffmpeg_path = shutil.which("ffmpeg")

        self.system = platform.system()
        self.machine = platform.machine()

        self._torch_available = False
        self._cuda_available = False
        self._gpu_name = None

        self._detect_compute()

    # ========================================================
    # Compute detection
    # ========================================================

    def _detect_compute(self) -> None:

        try:
            import torch

            self._torch_available = True
            self._cuda_available = bool(
                torch.cuda.is_available()
            )

            if self._cuda_available:
                try:
                    self._gpu_name = (
                        torch.cuda.get_device_name(0)
                    )
                except Exception:
                    self._gpu_name = "CUDA GPU"

        except Exception:
            self._torch_available = False
            self._cuda_available = False
            self._gpu_name = None

    # ========================================================
    # Device selection
    # ========================================================

    def device(self) -> str:

        if (
            self.config.use_gpu_if_available
            and self._cuda_available
        ):
            return "cuda"

        return "cpu"

    # ========================================================
    # Status
    # ========================================================

    def status(self) -> Dict[str, Any]:

        device = self.device()

        return {
            "success": True,
            "engine": self.name,
            "model": "NEO",
            "version": self.version,

            "layer": "body-renderer-gateway",

            "system": self.system,
            "machine": self.machine,

            "torch_available": self._torch_available,
            "cuda_available": self._cuda_available,
            "gpu_name": self._gpu_name,

            "device": device,

            "ffmpeg_available": (
                self.ffmpeg_path is not None
            ),

            "ffmpeg_path": self.ffmpeg_path,

            "face_renderer": "SadTalker",

            "body_renderer": "plugin-ready",

            "upper_body": "plugin-ready",
            "hand_motion": "plugin-ready",
            "gesture_generation": "plugin-ready",

            "physical_body_model_connected": False,

            "ready": True,

            "message": (
                "NEO v2 Body Renderer Gateway is ready. "
                "A physical body-generation model can now "
                "be connected without modifying NEO v1."
            ),
        }

    # ========================================================
    # Input validation
    # ========================================================

    def validate_inputs(
        self,
        face_video_path: Path,
        portrait_path: Path,
        audio_path: Path,
    ) -> Dict[str, Any]:

        face_video_path = Path(face_video_path)
        portrait_path = Path(portrait_path)
        audio_path = Path(audio_path)

        errors = []

        if not face_video_path.exists():
            errors.append(
                f"Face video not found: {face_video_path}"
            )

        if not portrait_path.exists():
            errors.append(
                f"Portrait not found: {portrait_path}"
            )

        if not audio_path.exists():
            errors.append(
                f"Audio not found: {audio_path}"
            )

        return {
            "success": len(errors) == 0,
            "errors": errors,
            "face_video_exists": face_video_path.exists(),
            "portrait_exists": portrait_path.exists(),
            "audio_exists": audio_path.exists(),
        }

    # ========================================================
    # Build body-render request
    # ========================================================

    def create_render_request(
        self,
        face_video_path: Path,
        portrait_path: Path,
        audio_path: Path,
        output_dir: Path,
        motion_style: str = "natural",
        emotion: str = "neutral",
        hand_strength: float = 0.50,
        torso_strength: float = 0.30,
    ) -> Dict[str, Any]:

        validation = self.validate_inputs(
            face_video_path=face_video_path,
            portrait_path=portrait_path,
            audio_path=audio_path,
        )

        output_dir = Path(output_dir)

        output_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        return {
            "success": validation["success"],

            "model": "NEO",
            "version": "v2",

            "device": self.device(),

            "face_video": str(
                Path(face_video_path)
            ),

            "portrait": str(
                Path(portrait_path)
            ),

            "audio": str(
                Path(audio_path)
            ),

            "output_dir": str(
                output_dir
            ),

            "motion_style": motion_style,
            "emotion": emotion,

            "hand_strength": max(
                0.0,
                min(1.0, hand_strength),
            ),

            "torso_strength": max(
                0.0,
                min(1.0, torso_strength),
            ),

            "validation": validation,

            "pipeline": [
                "face-video-input",
                "audio-analysis",
                "gesture-planning",
                "upper-body-generation",
                "hand-motion-generation",
                "face-body-composition",
                "audio-remux",
                "final-mp4",
            ],
        }

    # ========================================================
    # Safe passthrough
    # ========================================================

    def passthrough_face_video(
        self,
        face_video_path: Path,
        output_dir: Path,
    ) -> Dict[str, Any]:

        """
        Safe fallback.

        Until the real body model is connected, this method
        copies the successful NEO v1 video into the NEO v2
        output directory.

        It does NOT pretend that hand/body generation happened.
        """

        started = time.time()

        face_video_path = Path(
            face_video_path
        )

        output_dir = Path(
            output_dir
        )

        output_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        if not face_video_path.exists():
            return {
                "success": False,
                "status": "failed",
                "error": (
                    "Face video does not exist."
                ),
            }

        output_path = (
            output_dir /
            "neo_v2_passthrough.mp4"
        )

        shutil.copy2(
            face_video_path,
            output_path,
        )

        elapsed = round(
            time.time() - started,
            3,
        )

        return {
            "success": True,
            "status": "passthrough-complete",

            "model": "NEO",
            "version": "v2",

            "body_motion_generated": False,

            "source_video": str(
                face_video_path
            ),

            "output_video": str(
                output_path
            ),

            "render_seconds": elapsed,

            "message": (
                "NEO v1 face video was preserved successfully. "
                "The real body/hand model is not connected yet."
            ),
        }

    # ========================================================
    # FFmpeg validation
    # ========================================================

    def test_ffmpeg(self) -> Dict[str, Any]:

        if not self.ffmpeg_path:
            return {
                "success": False,
                "ffmpeg": False,
                "message": "FFmpeg was not found.",
            }

        try:

            result = subprocess.run(
                [
                    self.ffmpeg_path,
                    "-version",
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )

            first_line = ""

            if result.stdout:
                first_line = (
                    result.stdout
                    .splitlines()[0]
                )

            return {
                "success": result.returncode == 0,
                "ffmpeg": True,
                "path": self.ffmpeg_path,
                "version": first_line,
            }

        except Exception as exc:

            return {
                "success": False,
                "ffmpeg": True,
                "error": str(exc),
            }

    # ========================================================
    # Future external renderer hook
    # ========================================================

    def external_renderer_available(
        self,
        renderer_path: Optional[Path],
    ) -> bool:

        if renderer_path is None:
            return False

        renderer_path = Path(
            renderer_path
        )

        return renderer_path.exists()

    # ========================================================
    # Full gateway report
    # ========================================================

    def diagnostic(self) -> Dict[str, Any]:

        return {
            "model": "NEO",
            "version": "v2",

            "renderer_status": self.status(),

            "ffmpeg_test": self.test_ffmpeg(),

            "next_stage": (
                "Connect real upper-body / hand-motion model."
            ),
        }


# ============================================================
# Shared NEO Body Renderer
# ============================================================

neo_body_renderer = NEOBodyRenderer()


# ============================================================
# Developer Test
# ============================================================

if __name__ == "__main__":

    print("")
    print("=" * 60)
    print("NEO v2 BODY RENDERER")
    print("=" * 60)

    print("")
    print("STATUS:")
    print(
        neo_body_renderer.status()
    )

    print("")
    print("FFMPEG:")
    print(
        neo_body_renderer.test_ffmpeg()
    )

    print("")
    print("=" * 60)