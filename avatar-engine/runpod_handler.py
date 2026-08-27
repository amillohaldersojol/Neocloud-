import runpod

from engine.body_provider import NEOBodyProvider


provider = NEOBodyProvider()


def handler(job):
    """
    RunPod Serverless entrypoint for NeoCloud NEO V2.

    Expected input example:
    {
        "input": {
            "source_image": "...",
            "audio_path": "...",
            "motion_style": "natural",
            "emotion": "neutral"
        }
    }
    """

    try:
        payload = job.get("input", {})

        source_image = payload.get("source_image")
        audio_path = payload.get("audio_path")

        if not source_image or not audio_path:
            return {
                "success": False,
                "status": "missing-input",
                "message": "source_image and audio_path are required",
            }

        body_job = provider.create_job(
            source_image=source_image,
            audio_path=audio_path,
            motion_style=payload.get("motion_style", "natural"),
            emotion=payload.get("emotion", "neutral"),
            fps=int(payload.get("fps", 25)),
            width=int(payload.get("width", 512)),
            height=int(payload.get("height", 512)),
        )

        result = provider.submit(body_job)

        return {
            "success": result.get("success", False),
            "job_id": body_job.job_id,
            "result": result,
        }

    except Exception as exc:
        return {
            "success": False,
            "status": "worker-error",
            "error": str(exc),
        }


if __name__ == "__main__":
    runpod.serverless.start(
        {
            "handler": handler
        }
    )