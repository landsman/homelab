#!/bin/sh
set -eu

#
# MANUAL STEP: run on the box as root, after 001-init.sh.
#
# What it does:
#   - installs ffmpeg + build deps from apt
#   - builds whisper.cpp (whisper-cli + whisper-server) from source into /opt/whisper.cpp
#     (no Debian package, upstream publishes no linux binaries)
#   - downloads the ggml large-v3-turbo-q8_0 model (~874 MB, multilingual incl. cs)
#   - creates unprivileged 'whisper' user + systemd unit; API listens on 127.0.0.1:8004
#     (not exposed to the LAN — reach it over an SSH tunnel)
#   - the unit is NOT enabled — start it on demand, stop it to free RAM (~1.5 GB):
#       sudo systemctl start whisper-server
#       sudo systemctl stop whisper-server
#
# Why whisper.cpp and not ollama + gemma4:e2b: purpose-built ASR, much faster on
# CPU-only boxes, handles long files natively (gemma caps audio at 30 s/clip so
# clients must chunk), gives timestamps + srt/vtt, model is 2x smaller. Fully local.
#
# Remote use (any audio/video container, ffmpeg converts server-side):
#   ssh -L 8004:127.0.0.1:8004 <box>.pollos
#   curl -F file=@video.mp4 -F response_format=text http://127.0.0.1:8004/inference
#

WHISPER_MODEL=large-v3-turbo-q8_0
WHISPER_PORT=8004

apt-get update -y
apt-get install -y ffmpeg git build-essential cmake

if [ ! -d /opt/whisper.cpp ]; then
  git clone --depth 1 https://github.com/ggml-org/whisper.cpp /opt/whisper.cpp
fi
cmake -S /opt/whisper.cpp -B /opt/whisper.cpp/build -DCMAKE_BUILD_TYPE=Release
cmake --build /opt/whisper.cpp/build -j"$(nproc)" --target whisper-cli whisper-server
install -m 0755 /opt/whisper.cpp/build/bin/whisper-cli /usr/local/bin/whisper-cli
install -m 0755 /opt/whisper.cpp/build/bin/whisper-server /usr/local/bin/whisper-server

sh /opt/whisper.cpp/models/download-ggml-model.sh "$WHISPER_MODEL"

# unprivileged service user; writable dir only for --convert ffmpeg temp files
if ! id whisper >/dev/null 2>&1; then
  useradd --system --home /var/lib/whisper --shell /usr/sbin/nologin whisper
fi
mkdir -p /var/lib/whisper
chown whisper:whisper /var/lib/whisper

cat > /etc/systemd/system/whisper-server.service <<EOF
[Unit]
Description=whisper.cpp speech-to-text API
After=network-online.target
Wants=network-online.target

[Service]
User=whisper
Group=whisper
WorkingDirectory=/var/lib/whisper
ExecStart=/usr/local/bin/whisper-server \\
  -m /opt/whisper.cpp/models/ggml-${WHISPER_MODEL}.bin \\
  --host 127.0.0.1 --port ${WHISPER_PORT} \\
  --convert -l auto
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

echo
echo "whisper-server installed (not running — start it on demand)"
echo "start:  sudo systemctl start whisper-server"
echo "stop:   sudo systemctl stop whisper-server"
echo "tunnel: ssh -L ${WHISPER_PORT}:127.0.0.1:${WHISPER_PORT} $(hostname)"
echo "use:    curl -F file=@video.mp4 -F response_format=text http://127.0.0.1:${WHISPER_PORT}/inference"
