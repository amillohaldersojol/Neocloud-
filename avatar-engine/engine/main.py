from __future__ import annotations

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    BackgroundTasks,
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from pathlib import Path
from datetime import datetime
from typing import Optional

import json
import platform
import shutil
import uuid

from engine.avatar_pipeline import neo_avatar_pipeline


# ==========================================================
# NeoCloud NEO Avatar Engine
# NEO v1
#
# Current renderer:
#   SadTalker CPU
#
# Flow:
#   Upload portrait + audio
#       ↓
#   Create NeoCloud job
#       ↓
#   NEO v1 pipeline
#       ↓
#   SadTalker
#       ↓
#   neo_avatar.mp4
# ==========================================================


app = FastAPI(
    title="NeoCloud NEO Avatar Engine",
    description=(
        "Local NEO avatar generation backend for NeoCloud"
    ),
    version="1.0.0",
)


# ==========================================================
# CORS
# ==========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================================
# Directories
# ==========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

INPUT_DIR = BASE_DIR / "input"
OUTPUT_DIR = BASE_DIR / "output"
MODELS_DIR = BASE_DIR / "models"
JOBS_DIR = BASE_DIR / "jobs"

INPUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

MODELS_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

JOBS_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


# ==========================================================
# Configuration
# ==========================================================

ALLOWED_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

ALLOWED_AUDIO_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".m4a",
    ".mp4",
    ".aac",
}

MAX_IMAGE_SIZE = 20 * 1024 * 1024
MAX_AUDIO_SIZE = 50 * 1024 * 1024


# ==========================================================
# Helpers
# ==========================================================

def now_iso() -> str:
    return datetime.now().isoformat()


def create_job_id() -> str:

    timestamp = datetime.now().strftime(
        "%Y%m%d_%H%M%S"
    )

    short_id = uuid.uuid4().hex[:8]

    return f"{timestamp}_{short_id}"


def get_job_file(
    job_id: str,
) -> Path:

    return JOBS_DIR / f"{job_id}.json"


def save_job(
    job_id: str,
    data: dict,
) -> None:

    job_file = get_job_file(
        job_id
    )

    with open(
        job_file,
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            data,
            file,
            indent=2,
            ensure_ascii=False,
        )


def load_job(
    job_id: str,
) -> dict:

    job_file = get_job_file(
        job_id
    )

    if not job_file.exists():

        raise HTTPException(
            status_code=404,
            detail="Job not found.",
        )

    with open(
        job_file,
        "r",
        encoding="utf-8",
    ) as file:

        return json.load(
            file
        )


def get_extension(
    filename: str,
) -> str:

    return Path(
        filename or ""
    ).suffix.lower()


async def save_upload(
    upload: UploadFile,
    destination: Path,
) -> None:

    with open(
        destination,
        "wb",
    ) as buffer:

        shutil.copyfileobj(
            upload.file,
            buffer,
        )


# ==========================================================
# Background NEO Rendering
# ==========================================================

def run_neo_render(
    job_id: str,
    portrait_path: str,
    audio_path: str,
    motion_style: str,
) -> None:

    job = load_job(
        job_id
    )

    # ------------------------------------------------------
    # Start rendering
    # ------------------------------------------------------

    job["status"] = "rendering"

    job["pipeline"][
        "face_motion"
    ] = "processing"

    job["pipeline"][
        "lip_sync"
    ] = "processing"

    job["pipeline"][
        "final_render"
    ] = "waiting"

    job["render_started_at"] = (
        now_iso()
    )

    job["message"] = (
        "NEO v1 is rendering the avatar locally."
    )

    save_job(
        job_id,
        job,
    )

    # ------------------------------------------------------
    # Run NEO pipeline
    # ------------------------------------------------------

    result = neo_avatar_pipeline.render(
        portrait_path=Path(
            portrait_path
        ),
        audio_path=Path(
            audio_path
        ),
        job_id=job_id,
        motion_style=motion_style,
    )

    # Reload latest job
    job = load_job(
        job_id
    )

    # ------------------------------------------------------
    # Success
    # ------------------------------------------------------

    if result.get(
        "success"
    ):

        video_path = Path(
            result["video_path"]
        )

        job["success"] = True

        job["status"] = "ready"

        job["model"] = "NEO"

        job["model_version"] = "v1"

        job["renderer"] = (
            result.get(
                "renderer",
                "SadTalker",
            )
        )

        job["output_path"] = str(
            video_path
        )

        job["output_filename"] = (
            video_path.name
        )

        job["video_url"] = (
            f"/outputs/"
            f"{job_id}/"
            f"{video_path.name}"
        )

        job["render_seconds"] = (
            result.get(
                "render_seconds"
            )
        )

        job["render_finished_at"] = (
            now_iso()
        )

        job["pipeline"][
            "face_motion"
        ] = "complete"

        job["pipeline"][
            "lip_sync"
        ] = "complete"

        job["pipeline"][
            "final_render"
        ] = "complete"

        job["message"] = (
            "NEO v1 avatar video is ready."
        )

        save_job(
            job_id,
            job,
        )

        return


    # ------------------------------------------------------
    # Failure
    # ------------------------------------------------------

    job["success"] = False

    job["status"] = "failed"

    job["error"] = result.get(
        "error",
        "Unknown NEO rendering error.",
    )

    job["render_seconds"] = (
        result.get(
            "render_seconds"
        )
    )

    job["render_finished_at"] = (
        now_iso()
    )

    job["pipeline"][
        "face_motion"
    ] = "failed"

    job["pipeline"][
        "lip_sync"
    ] = "failed"

    job["pipeline"][
        "final_render"
    ] = "failed"

    job["message"] = (
        "NEO v1 rendering failed. "
        "Check the job error."
    )

    save_job(
        job_id,
        job,
    )


# ==========================================================
# Root
# ==========================================================

@app.get("/")
def root():

    return {
        "name":
            "NeoCloud NEO Avatar Engine",

        "model":
            "NEO",

        "version":
            "v1",

        "status":
            "online",

        "renderer":
            "SadTalker CPU",

        "message":
            "NEO avatar engine is running.",
    }


# ==========================================================
# Health Check
# ==========================================================

@app.get("/health")
def health():

    pipeline_status = (
        neo_avatar_pipeline.status()
    )

    return {
        "status":
            "healthy",

        "engine":
            "NeoCloud NEO Avatar Engine",

        "model":
            "NEO",

        "version":
            "v1",

        "python":
            platform.python_version(),

        "pipeline_ready":
            pipeline_status.get(
                "ready",
                False,
            ),

        "time":
            now_iso(),
    }


# ==========================================================
# NEO Information
# ==========================================================

@app.get("/engine/info")
def engine_info():

    return {
        "engine":
            "NeoCloud NEO Avatar Engine",

        "model":
            "NEO",

        "version":
            "v1",

        "mode":
            "local",

        "current_renderer":
            "SadTalker CPU",

        "external_avatar_api_required":
            False,

        "capabilities": {
            "portrait_upload":
                True,

            "audio_upload":
                True,

            "talking_avatar":
                True,

            "face_motion":
                True,

            "lip_sync":
                True,

            "mp4_output":
                True,

            "background_jobs":
                True,
        },

        "pipeline":
            neo_avatar_pipeline.status(),

        "future": [
            "LivePortrait",
            "MuseTalk",
            "NEO proprietary renderer",
            "NEO Voice",
            "NEO Editing",
        ],
    }


# ==========================================================
# Generate Avatar
# ==========================================================

@app.post("/generate")
async def generate_avatar(
    background_tasks: BackgroundTasks,

    portrait: UploadFile = File(...),

    audio: UploadFile = File(...),

    avatar_name: str = Form(
        "NeoCloud Avatar"
    ),

    language: str = Form(
        "English"
    ),

    aspect_ratio: str = Form(
        "9:16"
    ),

    motion_style: str = Form(
        "natural"
    ),

    script: Optional[str] = Form(
        None
    ),
):

    # ------------------------------------------------------
    # Check pipeline
    # ------------------------------------------------------

    if not neo_avatar_pipeline.is_ready():

        raise HTTPException(
            status_code=503,
            detail=(
                "NEO avatar pipeline is not ready."
            ),
        )


    # ------------------------------------------------------
    # Validate portrait extension
    # ------------------------------------------------------

    portrait_ext = get_extension(
        portrait.filename or ""
    )

    if (
        portrait_ext
        not in
        ALLOWED_IMAGE_EXTENSIONS
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Portrait must be "
                "JPG, JPEG, PNG or WebP."
            ),
        )


    # ------------------------------------------------------
    # Validate audio extension
    # ------------------------------------------------------

    audio_ext = get_extension(
        audio.filename or ""
    )

    if (
        audio_ext
        not in
        ALLOWED_AUDIO_EXTENSIONS
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Audio must be "
                "MP3, WAV, M4A, AAC "
                "or MP4 audio."
            ),
        )


    # ------------------------------------------------------
    # Create Job
    # ------------------------------------------------------

    job_id = create_job_id()

    job_input_dir = (
        INPUT_DIR /
        job_id
    )

    job_output_dir = (
        OUTPUT_DIR /
        job_id
    )

    job_input_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    job_output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )


    portrait_path = (
        job_input_dir /
        f"portrait{portrait_ext}"
    )

    audio_path = (
        job_input_dir /
        f"audio{audio_ext}"
    )


    # ------------------------------------------------------
    # Save uploads
    # ------------------------------------------------------

    await save_upload(
        portrait,
        portrait_path,
    )

    await save_upload(
        audio,
        audio_path,
    )


    # ------------------------------------------------------
    # Validate sizes
    # ------------------------------------------------------

    portrait_size = (
        portrait_path.stat().st_size
    )

    audio_size = (
        audio_path.stat().st_size
    )


    if portrait_size > MAX_IMAGE_SIZE:

        portrait_path.unlink(
            missing_ok=True
        )

        raise HTTPException(
            status_code=413,
            detail=(
                "Portrait is larger "
                "than 20 MB."
            ),
        )


    if audio_size > MAX_AUDIO_SIZE:

        audio_path.unlink(
            missing_ok=True
        )

        raise HTTPException(
            status_code=413,
            detail=(
                "Audio is larger "
                "than 50 MB."
            ),
        )


    # ------------------------------------------------------
    # Job data
    # ------------------------------------------------------

    job = {
        "success":
            True,

        "job_id":
            job_id,

        "status":
            "queued",

        "created_at":
            now_iso(),

        "model":
            "NEO",

        "model_version":
            "v1",

        "renderer":
            "SadTalker",

        "avatar_name":
            avatar_name,

        "language":
            language,

        "aspect_ratio":
            aspect_ratio,

        "motion_style":
            motion_style,

        "script":
            script,

        "portrait_path":
            str(
                portrait_path
            ),

        "audio_path":
            str(
                audio_path
            ),

        "output_path":
            None,

        "output_filename":
            None,

        "video_url":
            None,

        "pipeline": {
            "portrait_received":
                True,

            "audio_received":
                True,

            "face_motion":
                "queued",

            "lip_sync":
                "queued",

            "final_render":
                "queued",
        },

        "message":
            (
                "Files received. "
                "NEO v1 rendering has been queued."
            ),
    }


    save_job(
        job_id,
        job,
    )


    # ------------------------------------------------------
    # Start render in background
    # ------------------------------------------------------

    background_tasks.add_task(
        run_neo_render,
        job_id,
        str(
            portrait_path
        ),
        str(
            audio_path
        ),
        motion_style,
    )


    return {
        "success":
            True,

        "job_id":
            job_id,

        "status":
            "queued",

        "model":
            "NEO",

        "version":
            "v1",

        "message":
            (
                "NEO v1 render started. "
                "Check /jobs/{job_id} "
                "for progress."
            ),

        "status_url":
            f"/jobs/{job_id}",
    }


# ==========================================================
# Job Status
# ==========================================================

@app.get("/jobs/{job_id}")
def job_status(
    job_id: str,
):

    return load_job(
        job_id
    )


# ==========================================================
# List Jobs
# ==========================================================

@app.get("/jobs")
def list_jobs():

    jobs = []

    files = sorted(
        JOBS_DIR.glob("*.json"),
        reverse=True,
    )

    for job_file in files:

        try:

            with open(
                job_file,
                "r",
                encoding="utf-8",
            ) as file:

                data = json.load(
                    file
                )

            jobs.append({
                "job_id":
                    data.get(
                        "job_id"
                    ),

                "status":
                    data.get(
                        "status"
                    ),

                "model":
                    data.get(
                        "model"
                    ),

                "avatar_name":
                    data.get(
                        "avatar_name"
                    ),

                "created_at":
                    data.get(
                        "created_at"
                    ),

                "video_url":
                    data.get(
                        "video_url"
                    ),
            })

        except Exception:
            continue


    return {
        "count":
            len(jobs),

        "jobs":
            jobs,
    }


# ==========================================================
# Output Download / Play
# ==========================================================

@app.get(
    "/outputs/{job_id}/{filename}"
)
def output_file(
    job_id: str,
    filename: str,
):

    # Prevent path traversal
    safe_filename = Path(
        filename
    ).name

    file_path = (
        OUTPUT_DIR /
        job_id /
        safe_filename
    )

    if not file_path.exists():

        raise HTTPException(
            status_code=404,
            detail=(
                "Output video not found."
            ),
        )


    return FileResponse(
        path=file_path,
        media_type="video/mp4",
        filename=safe_filename,
    )


# ==========================================================
# Pipeline Test
# ==========================================================

@app.get("/pipeline/test")
def pipeline_test():

    status = (
        neo_avatar_pipeline.status()
    )

    return {
        "success":
            status.get(
                "ready",
                False,
            ),

        "model":
            "NEO",

        "version":
            "v1",

        "pipeline":
            status,

        "flow": [
            "portrait input",
            "audio input",
            "audio normalization",
            "face animation",
            "lip synchronization",
            "video rendering",
            "neo_avatar.mp4",
        ],

        "message":
            (
                "NEO v1 pipeline is ready."
                if status.get(
                    "ready"
                )
                else
                "NEO v1 pipeline is not ready."
            ),
    }


# ==========================================================
# Startup
# ==========================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "engine.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )