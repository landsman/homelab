# Build on the box that runs it.
FROM debian:bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ARG WHISPER_VERSION=v1.8.4
RUN git clone --depth 1 --branch ${WHISPER_VERSION} \
    https://github.com/ggml-org/whisper.cpp /src

# x86: GGML_NATIVE (default ON) tunes for the local CPU (AVX2 on the i5-6500T).
# ARM: GCC's native detection emits an -march with fp16fml but no plain +fp16,
# yet still enables the FP16 SIMD path, so the build dies on vfmaq_f16
# ("target specific option mismatch"). Pin a portable armv8.2 + fp16 baseline
# (Apple Silicon and Pi 5 both support it) and turn native detection off.
ARG TARGETARCH
RUN case "$TARGETARCH" in \
      arm64) GGML_FLAGS="-DGGML_NATIVE=OFF -DGGML_CPU_ARM_ARCH=armv8.2-a+fp16+dotprod" ;; \
      *)     GGML_FLAGS="" ;; \
    esac; \
    cmake -S /src -B /src/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF $GGML_FLAGS \
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
