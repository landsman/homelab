#!/usr/bin/env bash
# Split ONE file across the pollos boxes, then stitch the transcript back.
# Cuts are snapped to silences (ffmpeg silencedetect) so no word is split at a
# chunk boundary — whisper loses context at a hard cut, a silence cut avoids it.
# Output is plain text only; srt/vtt would need per-chunk timestamp offsetting.
#
# Prereq: ffmpeg + ffprobe locally; each box set up once (make build && make model).
# Usage:  ./transcribe-split.sh "/path/to/recording.m4a"
set -euo pipefail

BOXES=(walter.pollos jesse.pollos mike.pollos gus.pollos)
N=${#BOXES[@]}
SILENCE_DB=-30       # noise floor (dB) for silence detection
SILENCE_MIN=0.5      # min silence length (s) to count as a cut candidate
LANG_OPT=cs          # force language; chunks can be too short to auto-detect

src=${1:?usage: $0 audio-file}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src")
win=$(awk -v d="$dur" -v n="$N" 'BEGIN{print d/n/2}')   # snap window = half a chunk
echo "duration: ${dur}s -> $N parts"

# silence midpoints = best places to cut
mapfile -t silences < <(
  ffmpeg -hide_banner -nostats -i "$src" \
         -af "silencedetect=noise=${SILENCE_DB}dB:d=${SILENCE_MIN}" -f null - 2>&1 |
  awk '/silence_start/{s=$NF}
       /silence_end/{e=$(NF-3); if(s!=""){printf "%.3f\n",(s+e)/2; s=""}}'
)

# build cut points: each ideal i*dur/N snapped to the nearest silence within win
cuts=(0)
for ((i=1; i<N; i++)); do
  ideal=$(awk -v d="$dur" -v i="$i" -v n="$N" 'BEGIN{print d*i/n}')
  cuts+=("$(printf '%s\n' "${silences[@]}" | awk -v t="$ideal" -v w="$win" '
    function abs(x){return x<0?-x:x}
    BEGIN{bd=1e18; b=""}
    $1!=""{d=abs($1-t); if(d<bd){bd=d; b=$1}}
    END{ if(b!="" && bd<=w) print b; else print t }')")
done
cuts+=("$dur")

# extract each segment as 16k mono wav (fast seek, accurate length)
parts=()
for ((i=0; i<N; i++)); do
  ss=${cuts[$i]}; to=${cuts[$((i+1))]}
  len=$(awk -v a="$ss" -v b="$to" 'BEGIN{print b-a}')
  part="$work/part$i.wav"
  ffmpeg -hide_banner -loglevel error -ss "$ss" -i "$src" -t "$len" \
         -ar 16000 -ac 1 -c:a pcm_s16le "$part"
  parts+=("$part")
done

transcribe() {  # box  localwav  outfile
  local box=$1 wav=$2 out=$3 remote
  ssh "$box" 'cd whisper && make up >/dev/null && \
              until curl -sf http://127.0.0.1:8004/health >/dev/null; do sleep 2; done'
  remote=$(ssh "$box" 'mktemp -d')
  scp -q "$wav" "$box:$remote/part.wav"
  echo "[$box] $(basename "$wav")"
  ssh "$box" "curl -s -F file=@$remote/part.wav -F response_format=text \
              -F language=$LANG_OPT http://127.0.0.1:8004/inference" > "$out"
  ssh "$box" "rm -rf '$remote'; cd whisper && make down >/dev/null"
}

# one chunk per box, all in parallel
for ((i=0; i<N; i++)); do
  transcribe "${BOXES[$i]}" "${parts[$i]}" "$work/out$i.txt" &
done
wait

# stitch in order
out="${src%.*}.txt"
: > "$out"
for ((i=0; i<N; i++)); do cat "$work/out$i.txt" >> "$out"; printf '\n' >> "$out"; done
echo "done -> $out"