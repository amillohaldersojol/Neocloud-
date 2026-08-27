"""
NeoCloud NEO v2 - Physical Body Provider

Purpose:
- Connect NEO Body Adapter to a real body-generation backend.
- Keep NEO v1 SadTalker pipeline untouched.
- Support future local GPU / cloud GPU / external worker.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Optional
import json
import os
from dotenv import load_dotenv
load_dotenv(dotenv_path="../.env.local")
import time
import uuid


# ============================================================
# Provider configuration
# ============================================================

@dataclass
class BodyProviderConfig:
    provider: str = "disabled"
    model_name: str = "NEO-Body"
    model_version: str = "v2"

    # Future cloud/GPU worker
    endpoint: Optional[str] = None
    api_key: Optional[str] = None

    # Local worker/model folder
    local_model_path: Optional[str] = None

    timeout_seconds: int = 1800


# ============================================================
# Render job
# ============================================================

@dataclass
class PhysicalBodyJob:
    job_id: str
    source_image: str
    audio_path: str

    motion_style: str = "natural"
    emotion: str = "neutral"

    fps: int = 25
    width: int = 512
    height: int = 512

    output_dir: Optional[str] = None


# ============================================================
# NEO Physical Body Provider
# ============================================================

class NEOBodyProvider:
    """
    Provider layer for physical body generation.

    Current supported provider modes:

    disabled
        No physical body model is connected.

    local
        Reserved for a future local GPU body renderer.

    remote
        Reserved for a cloud/GPU worker.

    This architecture lets NEO use the same API regardless
    of where the actual body-generation model runs.
    """

    SUPPORTED_PROVIDERS = {
        "disabled",
        "local",
        "remote",
    }

    def __init__(
        self,
        config: Optional[BodyProviderConfig] = None,
    ) -> None:

        self.config = config or BodyProviderConfig(
            provider=os.getenv(
                "NEO_BODY_PROVIDER",
                "disabled",
            ),
            endpoint=os.getenv(
                "NEO_BODY_ENDPOINT"
            ),
            api_key=os.getenv(
                "NEO_BODY_API_KEY"
            ),
            local_model_path=os.getenv(
                "NEO_BODY_LOCAL_MODEL"
            ),
        )

        if (
            self.config.provider
            not in self.SUPPORTED_PROVIDERS
        ):
            self.config.provider = "disabled"

    # --------------------------------------------------------
    # Status
    # --------------------------------------------------------

    def status(self) -> Dict[str, Any]:

        provider = self.config.provider

        local_path_exists = False

        if self.config.local_model_path:
            local_path_exists = Path(
                self.config.local_model_path
            ).exists()

        remote_configured = bool(
            self.config.endpoint
        )

        physical_connected = False

        if provider == "local":
            physical_connected = (
                local_path_exists
            )

        elif provider == "remote":
            physical_connected = (
                remote_configured
            )

        return {
            "success": True,
            "engine": "NEO Physical Body Provider",
            "model": self.config.model_name,
            "version": self.config.model_version,

            "provider": provider,

            "physical_body_model_connected":
                physical_connected,

            "local_model_path":
                self.config.local_model_path,

            "local_model_exists":
                local_path_exists,

            "remote_endpoint":
                self.config.endpoint,

            "remote_configured":
                remote_configured,

            "api_key_configured":
                bool(self.config.api_key),

            "supported_providers":
                sorted(self.SUPPORTED_PROVIDERS),

            "ready": True,

            "message": (
                "NEO Body Provider layer is ready."
                if physical_connected
                else
                "Provider layer is ready, but no physical "
                "body-generation backend is connected yet."
            ),
        }

    # --------------------------------------------------------
    # Create job
    # --------------------------------------------------------

    def create_job(
        self,
        source_image: str,
        audio_path: str,
        motion_style: str = "natural",
        emotion: str = "neutral",
        fps: int = 25,
        width: int = 512,
        height: int = 512,
        output_dir: Optional[str] = None,
    ) -> PhysicalBodyJob:

        job_id = (
            "neo-body-"
            + uuid.uuid4().hex[:10]
        )

        return PhysicalBodyJob(
            job_id=job_id,
            source_image=source_image,
            audio_path=audio_path,
            motion_style=motion_style,
            emotion=emotion,
            fps=fps,
            width=width,
            height=height,
            output_dir=output_dir,
        )

    # --------------------------------------------------------
    # Validate job
    # --------------------------------------------------------

    def validate_job(
        self,
        job: PhysicalBodyJob,
    ) -> Dict[str, Any]:

        errors = []

        image_path = Path(
            job.source_image
        )

        audio_path = Path(
            job.audio_path
        )

        if not image_path.exists():
            errors.append(
                f"Source image not found: {image_path}"
            )

        if not audio_path.exists():
            errors.append(
                f"Audio file not found: {audio_path}"
            )

        return {
            "success": len(errors) == 0,
            "errors": errors,
            "source_image_exists":
                image_path.exists(),
            "audio_exists":
                audio_path.exists(),
        }

    # --------------------------------------------------------
    # Prepare provider request
    # --------------------------------------------------------

    def prepare_request(
        self,
        job: PhysicalBodyJob,
    ) -> Dict[str, Any]:

        validation = self.validate_job(
            job
        )

        return {
            "success":
                validation["success"],

            "job": asdict(job),

            "provider":
                self.config.provider,

            "validation":
                validation,

            "body_generation": {
                "upper_body": True,
                "hand_motion": True,
                "torso_motion": True,
                "head_motion": True,
                "emotion_motion": True,
            },

            "created_at":
                time.time(),
        }

    # --------------------------------------------------------
    # Submit
    # --------------------------------------------------------

    def submit(
        self,
        job: PhysicalBodyJob,
    ) -> Dict[str, Any]:

        request = self.prepare_request(
            job
        )

        if not request["success"]:
            return {
                "success": False,
                "status": "invalid-input",
                "errors":
                    request["validation"]["errors"],
            }

        provider = self.config.provider

        if provider == "disabled":

            return {
                "success": False,
                "status":
                    "physical-model-not-connected",

                "job_id":
                    job.job_id,

                "provider":
                    "disabled",

                "message": (
                    "NEO physical body provider is ready, "
                    "but no real body-generation model is "
                    "connected yet."
                ),
            }

        if provider == "local":

            return self._submit_local(
                job=job,
                request=request,
            )

        if provider == "remote":

            return self._submit_remote(
                job=job,
                request=request,
            )

        return {
            "success": False,
            "status": "unsupported-provider",
        }

    # --------------------------------------------------------
    # Local provider
    # --------------------------------------------------------

    def _submit_local(
        self,
        job: PhysicalBodyJob,
        request: Dict[str, Any],
    ) -> Dict[str, Any]:

        if not self.config.local_model_path:

            return {
                "success": False,
                "status":
                    "local-model-not-configured",

                "job_id":
                    job.job_id,
            }

        model_path = Path(
            self.config.local_model_path
        )

        if not model_path.exists():

            return {
                "success": False,
                "status":
                    "local-model-not-found",

                "job_id":
                    job.job_id,

                "model_path":
                    str(model_path),
            }

        # Real local GPU inference will be connected here.

        return {
            "success": False,
            "status":
                "local-provider-ready-for-model",

            "job_id":
                job.job_id,

            "model_path":
                str(model_path),

            "message": (
                "Local provider is configured. "
                "Actual physical-body inference "
                "will be connected next."
            ),
        }

    # --------------------------------------------------------
    # Remote provider
    # --------------------------------------------------------

    def _submit_remote(
        self,
        job: PhysicalBodyJob,
        request: Dict[str, Any],
    ) -> Dict[str, Any]:

        if not self.config.endpoint:

            return {
                "success": False,
                "status":
                    "remote-endpoint-not-configured",

                "job_id":
                    job.job_id,
            }

        # IMPORTANT:
        # We intentionally do not make the HTTP request yet.
        #
        # The next stage will connect this to our
        # GPU worker / body-generation service.

        return {
            "success": False,

            "status":
                "remote-provider-ready-for-worker",

            "job_id":
                job.job_id,

            "endpoint":
                self.config.endpoint,

            "request":
                request,

            "message": (
                "Remote GPU provider is configured. "
                "The actual worker request will be "
                "implemented in the next stage."
            ),
        }

    # --------------------------------------------------------
    # Diagnostic
    # --------------------------------------------------------

    def diagnostic(
        self,
    ) -> Dict[str, Any]:

        return {
            "provider":
                self.status(),

            "next_step": (
                "Connect a physical upper-body/"
                "hand-generation GPU backend."
            ),
        }


# ============================================================
# Shared provider
# ============================================================

neo_body_provider = NEOBodyProvider()


# ============================================================
# Developer test
# ============================================================

if __name__ == "__main__":

    print("")
    print("=" * 60)
    print("NEO PHYSICAL BODY PROVIDER")
    print("=" * 60)

    print(
        json.dumps(
            neo_body_provider.status(),
            indent=2,
        )
    )