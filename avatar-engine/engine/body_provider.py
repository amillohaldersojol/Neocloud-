"""
NeoCloud NEO v2 - Physical Body Provider

Purpose:
- Connect NEO Body Adapter to a real body-generation backend.
- Keep NEO v1 SadTalker pipeline untouched.
- Support local GPU / RunPod GPU / external worker.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Optional
import json
import os
import time
import uuid
import urllib.error
import urllib.request

from dotenv import load_dotenv


# ============================================================
# Environment
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env.local")
load_dotenv()


# ============================================================
# Provider configuration
# ============================================================

@dataclass
class BodyProviderConfig:
    provider: str = "disabled"

    model_name: str = "NEO-EchoMimicV2"
    model_version: str = "v2"

    endpoint: Optional[str] = None
    api_key: Optional[str] = None

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
            ).strip().lower(),

            endpoint=os.getenv(
                "NEO_BODY_ENDPOINT"
            ),

            api_key=os.getenv(
                "NEO_BODY_API_KEY"
            ),

            local_model_path=os.getenv(
                "NEO_BODY_LOCAL_MODEL"
            ),

            timeout_seconds=int(
                os.getenv(
                    "NEO_BODY_TIMEOUT",
                    "1800",
                )
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
            physical_connected = local_path_exists

        elif provider == "remote":
            physical_connected = remote_configured

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
                "NEO Body Provider is connected."
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
    # URL helper
    # --------------------------------------------------------

    @staticmethod
    def _is_url(value: str) -> bool:
        value = value.lower()

        return (
            value.startswith("http://")
            or value.startswith("https://")
        )

    # --------------------------------------------------------
    # Validate job
    # --------------------------------------------------------

    def validate_job(
        self,
        job: PhysicalBodyJob,
    ) -> Dict[str, Any]:

        errors = []

        source_is_url = self._is_url(
            job.source_image
        )

        audio_is_url = self._is_url(
            job.audio_path
        )

        image_exists = (
            True
            if source_is_url
            else Path(job.source_image).exists()
        )

        audio_exists = (
            True
            if audio_is_url
            else Path(job.audio_path).exists()
        )

        if not image_exists:
            errors.append(
                "Source image not found: "
                + job.source_image
            )

        if not audio_exists:
            errors.append(
                "Audio file not found: "
                + job.audio_path
            )

        return {
            "success": len(errors) == 0,
            "errors": errors,

            "source_image_exists":
                image_exists,

            "audio_exists":
                audio_exists,

            "source_image_is_url":
                source_is_url,

            "audio_is_url":
                audio_is_url,
        }

    # --------------------------------------------------------
    # Prepare worker payload
    # --------------------------------------------------------

    def prepare_request(
        self,
        job: PhysicalBodyJob,
    ) -> Dict[str, Any]:

        validation = self.validate_job(
            job
        )

        worker_input = {
            "source_image":
                job.source_image,

            "audio_path":
                job.audio_path,

            "motion_style":
                job.motion_style,

            "emotion":
                job.emotion,

            "fps":
                job.fps,

            "width":
                job.width,

            "height":
                job.height,

            "job_id":
                job.job_id,
        }

        return {
            "success":
                validation["success"],

            "job":
                asdict(job),

            "provider":
                self.config.provider,

            "validation":
                validation,

            "input":
                worker_input,

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
                    "NEO physical body provider "
                    "is not connected."
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

        return {
            "success": False,

            "status":
                "local-gpu-not-enabled",

            "job_id":
                job.job_id,

            "model_path":
                str(model_path),

            "message": (
                "EchoMimic V2 model files exist locally, "
                "but NEO V2 heavy inference is configured "
                "to run on the remote GPU worker."
            ),
        }

    # --------------------------------------------------------
    # RunPod endpoint normalizer
    # --------------------------------------------------------

    def _remote_url(
        self,
    ) -> str:

        endpoint = (
            self.config.endpoint or ""
        ).strip()

        if endpoint.startswith(
            "http://"
        ) or endpoint.startswith(
            "https://"
        ):
            return endpoint.rstrip("/")

        return (
            "https://api.runpod.ai/v2/"
            + endpoint
            + "/runsync"
        )

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

        url = self._remote_url()

        payload = {
            "input":
                request["input"]
        }

        headers = {
            "Content-Type":
                "application/json",
        }

        if self.config.api_key:
            headers["Authorization"] = (
                "Bearer "
                + self.config.api_key
            )

        encoded = json.dumps(
            payload
        ).encode("utf-8")

        http_request = urllib.request.Request(
            url=url,
            data=encoded,
            headers=headers,
            method="POST",
        )

        started_at = time.time()

        try:

            with urllib.request.urlopen(
                http_request,
                timeout=self.config.timeout_seconds,
            ) as response:

                raw = response.read().decode(
                    "utf-8"
                )

                response_data = (
                    json.loads(raw)
                    if raw
                    else {}
                )

        except urllib.error.HTTPError as exc:

            try:
                error_body = (
                    exc.read()
                    .decode(
                        "utf-8",
                        errors="replace",
                    )
                )
            except Exception:
                error_body = ""

            return {
                "success": False,

                "status":
                    "remote-http-error",

                "job_id":
                    job.job_id,

                "http_status":
                    exc.code,

                "error":
                    str(exc),

                "response":
                    error_body,
            }

        except urllib.error.URLError as exc:

            return {
                "success": False,

                "status":
                    "remote-connection-error",

                "job_id":
                    job.job_id,

                "error":
                    str(exc),
            }

        except TimeoutError:

            return {
                "success": False,

                "status":
                    "remote-timeout",

                "job_id":
                    job.job_id,

                "timeout_seconds":
                    self.config.timeout_seconds,
            }

        except Exception as exc:

            return {
                "success": False,

                "status":
                    "remote-request-failed",

                "job_id":
                    job.job_id,

                "error":
                    str(exc),
            }

        elapsed = round(
            time.time() - started_at,
            2,
        )

        runpod_status = (
            response_data.get("status")
            if isinstance(
                response_data,
                dict,
            )
            else None
        )

        output = (
            response_data.get("output")
            if isinstance(
                response_data,
                dict,
            )
            else None
        )

        worker_error = None

        if isinstance(
            output,
            dict,
        ):
            worker_error = (
                output.get("error")
                or output.get("message")
            )

        success = (
            runpod_status
            in {
                "COMPLETED",
                "completed",
            }
        )

        if (
            isinstance(output, dict)
            and output.get("success") is False
        ):
            success = False

        return {
            "success":
                success,

            "status":
                (
                    "completed"
                    if success
                    else
                    (
                        runpod_status
                        or "remote-worker-error"
                    )
                ),

            "job_id":
                job.job_id,

            "provider":
                "remote",

            "endpoint":
                url,

            "elapsed_seconds":
                elapsed,

            "runpod":
                response_data,

            "output":
                output,

            "error":
                worker_error,
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
                "Connect RunPod worker to "
                "EchoMimic V2 inference."
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