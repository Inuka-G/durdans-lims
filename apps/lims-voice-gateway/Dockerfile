# The voice gateway runs with host networking on the LIMS box: aiortc binds
# ephemeral UDP ports for SRTP, and publishing a 64k-port range through the
# docker proxy is not a thing. Host networking also means the port below is a
# convention, not a mapping — keep it in sync with the compose override.
FROM python:3.12-slim

# The upgrade is deliberate, not hygiene: the slim base ships util-linux with
# HIGH CVEs whose fixes sit in trixie-security, and the Trivy release gate (fail
# on HIGH/CRITICAL, ignore-unfixed) rightly refuses an image that left them
# untaken. It has to be dist-upgrade: the fixed util-linux pulls a new
# dependency, and plain `upgrade` silently holds such packages back — which is
# exactly what happened on the first two release attempts.
#
# ffmpeg: aiortc uses PyAV for Opus; the manylinux wheels bundle codecs, but a
# resolver fallback to source needs the libs present.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get dist-upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/voice-gateway

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PORT=8085
EXPOSE 8085

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8085"]
