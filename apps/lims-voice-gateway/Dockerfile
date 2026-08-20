# The voice gateway runs with host networking on the LIMS box: aiortc binds
# ephemeral UDP ports for SRTP, and publishing a 64k-port range through the
# docker proxy is not a thing. Host networking also means the port below is a
# convention, not a mapping — keep it in sync with the compose override.
FROM python:3.12-slim

# ffmpeg: aiortc uses PyAV for Opus; the manylinux wheels bundle codecs, but a
# resolver fallback to source needs the libs present. Small price for a build
# that cannot be broken by a wheel gap.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/voice-gateway

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PORT=8085
EXPOSE 8085

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8085"]
