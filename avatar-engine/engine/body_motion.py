from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Any
import json
import time


# ==========================================================
# NeoCloud NEO v2 Body Motion Layer
#
# Purpose:
#   - Keep NEO v1 SadTalker lip-sync untouched
#   - Add a separate body-motion stage
#   - Prepare architecture for:
#       * upper-body motion
#       * hand gestures
#       * emotion-aware movement
#       * future full-body renderer
#
# Current mode:
#   architecture / orchestration layer
# ==========================================================


@dataclass
class BodyMotionConfig:
    motion_style: str = "natural"
    gesture_strength: float = 0.55
    head_motion_strength: float = 0.35
    hand_motion_strength: float = 0.50
    torso_motion_strength: float = 0.30
    emotion: str = "neutral"
    fps: int = 25


class NEOBodyMotion:
    """
    NEO v2 body-motion orchestration layer.

    This file does NOT replace SadTalker.

    NEO v1:
        portrait + audio
            -> SadTalker
            -> lip-sync avatar

    NEO v2:
        portrait + audio
            -> SadTalker face/lip-sync
            -> NEO body-motion layer
            -> upper-body / hand animation
            -> final compositor
    """

    def __init__(self) -> None:
        self.name = "NEO Body Motion"
        self.version = "v2"
        self.mode = "local-cpu"
        self.renderer = "placeholder-body-renderer"

        self.supported_motion_styles = [
            "natural",
            "presenter",
            "energetic",
            "calm",
            "explainer",
        ]

        self.supported_emotions = [
            "neutral",
            "happy",
            "serious",
            "excited",
            "calm",
        ]

    # ------------------------------------------------------
    # Status
    # ------------------------------------------------------

    def status(self) -> Dict[str, Any]:
        return {
            "engine": self.name,
            "version": self.version,
            "mode": self.mode,
            "renderer": self.renderer,
            "ready": True,
            "upper_body": "architecture-ready",
            "hand_motion": "architecture-ready",
            "torso_motion": "architecture-ready",
            "emotion_motion": "architecture-ready",
            "full_body_renderer": "coming-next",
            "supported_motion_styles": self.supported_motion_styles,
            "supported_emotions": self.supported_emotions,
        }

    # ------------------------------------------------------
    # Motion plan
    # ------------------------------------------------------

    def create_motion_plan(
        self,
        audio_path: Path,
        motion_style: str = "natural",
        emotion: str = "neutral",
    ) -> Dict[str, Any]:

        if motion_style not in self.supported_motion_styles:
            motion_style = "natural"

        if emotion not in self.supported_emotions:
            emotion = "neutral"

        config = self._preset_for_style(
            motion_style=motion_style,
            emotion=emotion,
        )

        return {
            "success": True,
            "audio_path": str(audio_path),
            "motion_style": config.motion_style,
            "emotion": config.emotion,
            "fps": config.fps,
            "gesture_strength": config.gesture_strength,
            "head_motion_strength": config.head_motion_strength,
            "hand_motion_strength": config.hand_motion_strength,
            "torso_motion_strength": config.torso_motion_strength,
            "timeline": [
                "audio analysis",
                "speech rhythm detection",
                "gesture timing",
                "upper-body motion",
                "hand motion",
                "face-video synchronization",
                "final composition",
            ],
        }

    # ------------------------------------------------------
    # Renderer placeholder
    # ------------------------------------------------------

    def render(
        self,
        face_video_path: Path,
        portrait_path: Path,
        audio_path: Path,
        output_dir: Path,
        motion_style: str = "natural",
        emotion: str = "neutral",
    ) -> Dict[str, Any]:

        started = time.time()

        output_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        motion_plan = self.create_motion_plan(
            audio_path=audio_path,
            motion_style=motion_style,
            emotion=emotion,
        )

        plan_path = (
            output_dir /
            "body_motion_plan.json"
        )

        with open(
            plan_path,
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                motion_plan,
                file,
                indent=2,
                ensure_ascii=False,
            )

        elapsed = round(
            time.time() - started,
            3,
        )

        return {
            "success": True,
            "status": "motion-plan-ready",
            "model": "NEO",
            "version": "v2",
            "face_video_path": str(face_video_path),
            "portrait_path": str(portrait_path),
            "audio_path": str(audio_path),
            "motion_plan_path": str(plan_path),
            "motion_style": motion_style,
            "emotion": emotion,
            "render_seconds": elapsed,
            "message": (
                "NEO v2 body-motion plan created. "
                "The physical body renderer will be connected next."
            ),
        }

    # ------------------------------------------------------
    # Presets
    # ------------------------------------------------------

    def _preset_for_style(
        self,
        motion_style: str,
        emotion: str,
    ) -> BodyMotionConfig:

        presets = {
            "natural": BodyMotionConfig(
                motion_style="natural",
                gesture_strength=0.50,
                head_motion_strength=0.35,
                hand_motion_strength=0.45,
                torso_motion_strength=0.25,
                emotion=emotion,
            ),

            "presenter": BodyMotionConfig(
                motion_style="presenter",
                gesture_strength=0.65,
                head_motion_strength=0.30,
                hand_motion_strength=0.70,
                torso_motion_strength=0.30,
                emotion=emotion,
            ),

            "energetic": BodyMotionConfig(
                motion_style="energetic",
                gesture_strength=0.85,
                head_motion_strength=0.55,
                hand_motion_strength=0.90,
                torso_motion_strength=0.55,
                emotion=emotion,
            ),

            "calm": BodyMotionConfig(
                motion_style="calm",
                gesture_strength=0.25,
                head_motion_strength=0.20,
                hand_motion_strength=0.20,
                torso_motion_strength=0.15,
                emotion=emotion,
            ),

            "explainer": BodyMotionConfig(
                motion_style="explainer",
                gesture_strength=0.75,
                head_motion_strength=0.35,
                hand_motion_strength=0.80,
                torso_motion_strength=0.35,
                emotion=emotion,
            ),
        }

        return presets.get(
            motion_style,
            presets["natural"],
        )


# ==========================================================
# Shared instance
# ==========================================================

neo_body_motion = NEOBodyMotion()


# ==========================================================
# Local test
# ==========================================================

if __name__ == "__main__":
    print("")
    print("NEO v2 Body Motion")
    print("Status:")
    print(
        neo_body_motion.status()
    )