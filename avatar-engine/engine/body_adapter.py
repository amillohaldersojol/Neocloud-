"""
NeoCloud NEO v2 - Body Adapter
Bridge between NEO motion architecture and the physical body renderer.

This layer is intentionally model-agnostic:
a real body-generation model can be connected later without changing
the existing NEO v1 avatar pipeline.
"""

from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional
import time

from engine.body_motion import neo_body_motion
from engine.body_renderer import neo_body_renderer


@dataclass
class BodyRenderRequest:
    job_id: str
    source_image: Optional[str] = None
    audio_path: Optional[str] = None
    motion_style: str = "natural"
    emotion: str = "neutral"
    fps: int = 25
    width: int = 512
    height: int = 512


class NEOBodyAdapter:
    """
    NEO v2 adapter.

    Responsibilities:
    1. Receive an avatar/body render request.
    2. Resolve body-motion instructions.
    3. Send normalized instructions to the body-renderer gateway.
    4. Keep NEO v1 untouched.
    """

    def __init__(self) -> None:
        self.name = "NEO Body Adapter"
        self.version = "v2"
        self.ready = True

    def status(self) -> Dict[str, Any]:
        motion_status = neo_body_motion.status()
        renderer_status = neo_body_renderer.status()

        return {
            "success": True,
            "engine": self.name,
            "version": self.version,
            "ready": self.ready,
            "motion_engine_ready": bool(motion_status),
            "renderer_ready": bool(renderer_status),
            "physical_body_model_connected":
                renderer_status.get("physical_body_model_connected", False),
            "mode": renderer_status.get("device", "cpu"),
            "message": (
                "NEO v2 Body Adapter is ready. "
                "Physical body model can be attached through the renderer gateway."
            ),
        }

    def build_motion(
        self,
        motion_style: str = "natural",
        emotion: str = "neutral",
    ) -> Dict[str, Any]:

        # Keep this adapter compatible with the current motion architecture.
        return {
            "motion_style": motion_style,
            "emotion": emotion,
            "upper_body": True,
            "head_motion": True,
            "torso_motion": True,
            "hand_motion": True,
        }

    def prepare_job(self, request: BodyRenderRequest) -> Dict[str, Any]:
        motion = self.build_motion(
            motion_style=request.motion_style,
            emotion=request.emotion,
        )

        return {
            "success": True,
            "job_id": request.job_id,
            "created_at": time.time(),
            "request": asdict(request),
            "motion": motion,
            "pipeline": {
                "motion": "NEO Body Motion v2",
                "adapter": "NEO Body Adapter v2",
                "renderer": "NEO Body Renderer v2",
            },
            "physical_body_model_connected":
                self.status()["physical_body_model_connected"],
        }

    def create_request(
        self,
        job_id: str,
        source_image: Optional[str] = None,
        audio_path: Optional[str] = None,
        motion_style: str = "natural",
        emotion: str = "neutral",
        fps: int = 25,
        width: int = 512,
        height: int = 512,
    ) -> BodyRenderRequest:

        return BodyRenderRequest(
            job_id=job_id,
            source_image=source_image,
            audio_path=audio_path,
            motion_style=motion_style,
            emotion=emotion,
            fps=fps,
            width=width,
            height=height,
        )


# Shared instance
neo_body_adapter = NEOBodyAdapter()


if __name__ == "__main__":
    print(neo_body_adapter.status())

    test_request = neo_body_adapter.create_request(
        job_id="neo-v2-test",
        motion_style="natural",
        emotion="neutral",
    )

    print(neo_body_adapter.prepare_job(test_request))