#!/bin/bash
# Google TTS(Chirp3-HD Orus)で音声を作り直し、mp4を書き出すまで一括で行う。
# 事前に環境変数 GOOGLE_TTS_API_KEY にAPIキーが入っていること。
#
# 使い方:  bash shorts/tools/remake.sh
set -e
cd "$(dirname "$0")/.."

# Claude Codeリモート環境のプロキシ証明書に対応
if [ -f /root/.ccr/ca-bundle.crt ]; then
  export SSL_CERT_FILE="${SSL_CERT_FILE:-/root/.ccr/ca-bundle.crt}"
fi

if [ -z "$GOOGLE_TTS_API_KEY" ]; then
  echo "エラー: 環境変数 GOOGLE_TTS_API_KEY が設定されていません。"
  echo "Claude Code の Environments 設定でキーを登録してください。"
  exit 1
fi

# --- 初回セットアップ(済みならスキップされる) ---
if [ ! -d node_modules ]; then
  echo "[1/5] npm install ..."
  npm install
fi
if [ ! -d .venv ]; then
  echo "[2/5] Python環境を準備 ..."
  python3 -m venv .venv
  .venv/bin/pip -q install pyopenjtalk-plus numpy soundfile
fi
# フォントをOSにインストール(レンダリングに必要)
if ! fc-list 2>/dev/null | grep -qi "Zen Maru"; then
  echo "[3/5] フォントをインストール ..."
  mkdir -p ~/.fonts && cp public/fonts/*.ttf ~/.fonts/ && fc-cache -f >/dev/null
fi

# --- 音声生成 → シーン割り → 書き出し ---
echo "[4/5] Google TTS (ja-JP-Chirp3-HD-Orus) で音声を生成 ..."
.venv/bin/python tools/make_voice_google.py
node tools/build_props.mjs

echo "[5/5] mp4を書き出し ..."
npx remotion render src/index.ts ShortVideo out/short.mp4 \
  --props=src/props.json --codec=h264 --timeout=300000

echo "完成: shorts/out/short.mp4"
