#!/usr/bin/env bash
# 台本1本のナレーションだけを合成し、シーンをつなげた通し音声(mp3)を作る。
# レンダリングはしないので、テンポ・間・読みを耳で確認したいときに使う。
#
# 使い方:
#   tools/preview_voice.sh scripts/<名前>.json                # 音声を新規合成してつなげる
#   tools/preview_voice.sh scripts/<名前>.json --skip-voice   # 既存のwavをそのままつなげる(合成し直さない)
#
# 出力:
#   /tmp/preview_<名前>.mp3   シーン間に0.25秒の間を入れて連結したもの
#
# 前提: shorts/ ディレクトリで実行すること。新規合成する場合は GOOGLE_TTS_API_KEY が必要。

set -euo pipefail

SCRIPT_PATH="${1:-}"
SKIP_VOICE=0
[[ "${2:-}" == "--skip-voice" ]] && SKIP_VOICE=1

if [[ -z "$SCRIPT_PATH" ]]; then
  echo "使い方: tools/preview_voice.sh <台本.json> [--skip-voice]" >&2
  exit 1
fi
if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "台本が見つかりません: $SCRIPT_PATH" >&2
  exit 1
fi

NAME="$(basename "$SCRIPT_PATH" .json)"
AUDIO_DIR="public/audio_${NAME}"
OUT="/tmp/preview_${NAME}.mp3"

if [[ "$SKIP_VOICE" -eq 1 ]]; then
  echo "▶ ${NAME}  既存の音声を使用(合成スキップ)"
  if [[ ! -d "$AUDIO_DIR" ]]; then
    echo "音声が見つかりません: ${AUDIO_DIR}(--skip-voice なしで一度合成してください)" >&2
    exit 1
  fi
else
  echo "▶ ${NAME}  ナレーションを合成"
  python3 tools/make_voice_google.py "$SCRIPT_PATH" "$AUDIO_DIR"
fi

FILES=("${AUDIO_DIR}"/*.wav)
N=${#FILES[@]}

INPUTS=()
for f in "${FILES[@]}"; do
  INPUTS+=(-i "$f")
done

FILTER=""
LABELS=""
for i in $(seq 0 $((N - 1))); do
  FILTER+="[$i]apad=pad_dur=0.25[a$i];"
  LABELS+="[a$i]"
done
FILTER+="${LABELS}concat=n=${N}:v=0:a=1[out]"

npx remotion ffmpeg "${INPUTS[@]}" -filter_complex "$FILTER" -map "[out]" \
  -c:a libmp3lame -q:a 4 "$OUT" -y -loglevel error

DUR="$( (npx remotion ffmpeg -i "$OUT" 2>&1 || true) | grep -om1 'Duration: [0-9:.]*' )"
echo
echo "✅ 完了: ${OUT}  (${DUR})"
echo "   ※シーン間に0.25秒の間を機械的に挿入したもの。実際の映像とは尺が多少ずれる"
