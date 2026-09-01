FROM python:3.11-slim

WORKDIR /app

# ============================================================
# System packages
# ============================================================

RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    git-lfs \
    curl \
    wget \
    libgl1 \
    libglib2.0-0 \
    libsndfile1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ============================================================
# Git LFS
# ============================================================

RUN git lfs install

# ============================================================
# Python packaging tools
# ============================================================

RUN python -m pip install --no-cache-dir \
    "pip<26" \
    "setuptools<81" \
    wheel

# ============================================================
# NeoCloud Python dependencies
# ============================================================

COPY avatar-engine/requirements.txt .

RUN python -m pip install --no-cache-dir -r requirements.txt

# ============================================================
# Copy NeoCloud Avatar Engine
# ============================================================

COPY avatar-engine/ .

# ============================================================
# EchoMimic V2 source
# ============================================================

RUN rm -rf /app/models/echomimic_v2 \
    && mkdir -p /app/models \
    && git clone \
       https://github.com/antgroup/echomimic_v2.git \
       /app/models/echomimic_v2

WORKDIR /app/models/echomimic_v2

# ============================================================
# EchoMimic dependency compatibility fixes
# ============================================================

RUN sed -i \
    's/onnxruntime-gpu==1\.20\.1/onnxruntime-gpu==1.20.2/g' \
    requirements.txt

RUN python -m pip install --no-cache-dir \
    "setuptools<81" \
    wheel

RUN python -m pip install \
    --no-cache-dir \
    --no-build-isolation \
    -r requirements.txt

# ============================================================
# Main EchoMimic V2 checkpoints
# ============================================================

RUN git clone \
    https://huggingface.co/BadToBest/EchoMimicV2 \
    /tmp/echomimic_weights \
    && mkdir -p ./pretrained_weights \
    && cp /tmp/echomimic_weights/*.pth ./pretrained_weights/ \
    && rm -rf /tmp/echomimic_weights

# ============================================================
# Stable Diffusion image variation model
# ============================================================

RUN git clone \
    https://huggingface.co/lambdalabs/sd-image-variations-diffusers \
    ./pretrained_weights/sd-image-variations-diffusers

# ============================================================
# Stable Diffusion VAE
# ============================================================

RUN git clone \
    https://huggingface.co/stabilityai/sd-vae-ft-mse \
    ./pretrained_weights/sd-vae-ft-mse

# ============================================================
# Wav2Vec2
# ============================================================

RUN git clone \
    https://huggingface.co/facebook/wav2vec2-base-960h \
    ./pretrained_weights/wav2vec2-base-960h

# ============================================================
# Whisper tiny.pt
# ============================================================

RUN mkdir -p ./pretrained_weights/audio_processor \
    && wget -O ./pretrained_weights/audio_processor/tiny.pt \
    https://openaipublic.azureedge.net/main/whisper/models/65147644a518d12f04e32d6f3b26facc3f8dd46e5390956a9424a650c0ce22b9/tiny.pt
# ============================================================
# Verify critical files
# ============================================================

RUN test -f ./pretrained_weights/denoising_unet.pth \
    && test -f ./pretrained_weights/reference_unet.pth \
    && test -f ./pretrained_weights/pose_encoder.pth \
    && test -f ./pretrained_weights/motion_module.pth \
    && test -f ./pretrained_weights/audio_processor/tiny.pt \
    && test -d ./pretrained_weights/sd-image-variations-diffusers \
    && test -d ./pretrained_weights/sd-vae-ft-mse \
    && test -d ./pretrained_weights/wav2vec2-base-960h

# ============================================================
# Back to NeoCloud worker
# ============================================================

WORKDIR /app

ENV PYTHONUNBUFFERED=1

CMD ["python", "-u", "runpod_handler.py"]