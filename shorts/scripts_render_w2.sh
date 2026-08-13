#!/usr/bin/env bash
# Week2 一括再レンダリング(既存props/音声そのまま)
set -u
cd "$(dirname "$0")"

# name:composition の対応
items=(
  "w2d1_am_gazou:RankingVideo"
  "w2d1_pm_ubawareru:ContrarianVideo"
  "w2d2_am_gijiroku:RankingVideo"
  "w2d2_pm_douga:RankingVideo"
  "w2d3_am_writer:RankingVideo"
  "w2d3_pm_salon:ContrarianVideo"
  "w2d4_am_shiryo:RankingVideo"
  "w2d4_pm_marunage:ContrarianVideo"
  "w2d5_am_designer:RankingVideo"
  "w2d5_pm_shinjisugi:ContrarianVideo"
  "w2d6_am_muryo2:RankingVideo"
  "w2d6_pm_100man:ContrarianVideo"
  "w2d7_am_news2:RankingVideo"
  "w2d7_pm_kasegenai:ContrarianVideo"
)

# 引数で対象を絞れる(例: skip 済みの1本目を飛ばす)。未指定なら全部。
only="${1:-}"

log="out/render_w2.log"
: > "$log"
for it in "${items[@]}"; do
  name="${it%%:*}"; comp="${it##*:}"
  if [ -n "$only" ] && [ "$name" != "$only" ]; then continue; fi
  echo "[$(date +%H:%M:%S)] START $name ($comp)" | tee -a "$log"
  npx remotion render src/index.ts "$comp" "out/${name}.mp4" \
    --props="src/props_${name}.json" --codec=h264 >>"$log" 2>&1
  rc=$?
  if [ $rc -eq 0 ]; then
    sz=$(du -h "out/${name}.mp4" | cut -f1)
    echo "[$(date +%H:%M:%S)] OK    $name ($sz)" | tee -a "$log"
  else
    echo "[$(date +%H:%M:%S)] FAIL  $name rc=$rc" | tee -a "$log"
  fi
done
echo "[$(date +%H:%M:%S)] ALL DONE" | tee -a "$log"
