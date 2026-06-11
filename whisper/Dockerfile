# Build on the box that runs it — GGML_NATIVE (default ON) tunes for the local CPU.
FROM debian:bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ARG WHISPER_VERSION=v1.8.4
RUN git clone --depth 1 --branch ${WHISPER_VERSION} \
    https://github.com/ggml-org/whisper.cpp /src

RUN cmake -S /src -B /src/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
  && cmake --build /src/build -j --target whisper-server

FROM debian:bookworm-slim

# ffmpeg: server-side --convert of uploaded audio/video; curl: healthcheck;
# libgomp1: ggml OpenMP runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl libgomp1 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /src/build/bin/whisper-server /usr/local/bin/whisper-server

# --convert writes temp files to cwd
USER nobody:nogroup
WORKDIR /tmp

ENTRYPOINT ["whisper-server"]
