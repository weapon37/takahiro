#!/usr/bin/env bash
# 台本JSON 1本から、音声合成 → props生成 → レンダリング → QA用フレーム抽出 までを一括で行う。
#
# 使い方:
#   tools/make_video.sh scripts/w5a_example.json
#   tools/make_video.sh scripts/w5a_example.json --skip-voice   # 音声を作り直さない(台本のテロップだけ直したとき)
#
# 前提:
#   - shorts/ ディレクトリで実行すること
#   - 環境変数 GOOGLE_TTS_API_KEY が設定されていること(--skip-voice なら不要)
#
# 出力:
#   public/audio_<名前>/*.wav   ナレーション
#   src/props_<名前>.json        Remotion用props
#   out/<名前>.mp4               完成動画(--crf=25。30MBの送信上限に収めるため)
#   /tmp/qa_<名前>/*.png         QA用の抜き出しフレーム(各シーンの中央)
#
# 注意: このスクリプトは「機械的な工程」だけを自動化する。
#   台本の中身(順位の根拠・テロップの言い回し・背景の割り当て)と
#   フレームの目視確認は自動化していない。誤読・テロップのはみ出しは
#   ここでは検出できないため、必ず出力されたフレームを人が見ること。

set -euo pipefail

SCRIPT_PATH="${1:-}"
SKIP_VOICE=0
[[ "${2:-}" == "--skip-voice" ]] && SKIP_VOICE=1

if [[ -z "$SCRIPT_PATH" ]]; then
  echo "使い方: tools/make_video.sh <台本.json> [--skip-voice]" >&2
  exit 1
fi
if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "台本が見つかりません: $SCRIPT_PATH" >&2
  exit 1
fi

NAME="$(basename "$SCRIPT_PATH" .json)"
AUDIO_DIR="audio_${NAME}"
PROPS="src/props_${NAME}.json"
OUT="out/${NAME}.mp4"
QA_DIR="/tmp/qa_${NAME}"

# 台本の template フィールドから合成先(Remotionのコンポジション名)を決める
COMP="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['template'])" "$SCRIPT_PATH")"

echo "▶ ${NAME}  (composition: ${COMP})"

# 1. ナレーション生成
if [[ "$SKIP_VOICE" -eq 1 ]]; then
  echo "── 1/4 音声: スキップ"
else
  echo "── 1/4 音声を合成"
  python3 tools/make_voice_google.py "$SCRIPT_PATH" "public/${AUDIO_DIR}"
fi

# 2. props生成(各wavの実尺からシーン長を計算する)
echo "── 2/4 propsを生成"
node tools/build_props_generic.mjs "$SCRIPT_PATH" "$AUDIO_DIR" "$PROPS"

# 3. レンダリング
echo "── 3/4 レンダリング(数分かかる)"
npx remotion render src/index.ts "$COMP" "$OUT" --props="$PROPS" --codec=h264 --crf=25 --log=error

# 4. QA用フレーム抽出(各シーンの中央フレームを1枚ずつ)
echo "── 4/4 QAフレームを抽出"
rm -rf "$QA_DIR" && mkdir -p "$QA_DIR"
python3 -c "
import json,sys
p=json.load(open(sys.argv[1]))
t=0
for i,s in enumerate(p['scenes']):
    d=s.get('durationInFrames',0)
    print(f\"{i:02d}_{s.get('role','scene')} {t+d//2}\")
    t+=d
" "$PROPS" | while read -r label frame; do
  npx remotion still src/index.ts "$COMP" "${QA_DIR}/${label}.png" \
    --props="$PROPS" --frame="$frame" --log=error &
done
wait

SIZE="$(du -h "$OUT" | cut -f1)"
SEC="$(python3 -c "
import json,sys
p=json.load(open(sys.argv[1]))
print(round(sum(s.get('durationInFrames',0) for s in p['scenes'])/30,1))
" "$PROPS")"

echo
echo "✅ 完了: ${OUT}  ${SEC}秒 / ${SIZE}"
echo "   QAフレーム: ${QA_DIR}/"
echo
echo "⚠ 次は人が確認すること:"
echo "   1) 上の音声ログに ⚠ が出ていないか(読みが割れる語)"
echo "   2) QAフレームでテロップのはみ出し・折り返しの崩れがないか"
echo "   3) 尺が34〜45秒に収まっているか(現在 ${SEC}秒)"
