// 任意の台本JSONと音声ディレクトリから props JSON を生成する汎用ビルダー
// 使い方:  node tools/build_props_generic.mjs <台本.json> <音声dir(public内)> <出力props.json>
// 例:      node tools/build_props_generic.mjs script_contra.json audio_contra src/props_contra.json
// 台本の各sentenceのフィールド(role, telop, num, vs, day, big, items, keyword...)はそのままpropsへ渡す。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FPS = 30;
const PAD_FRAMES = 6;

const [scriptRel, audioDir, outRel] = process.argv.slice(2);
if (!scriptRel || !audioDir || !outRel) {
  console.error('使い方: node tools/build_props_generic.mjs <台本.json> <音声dir> <出力props.json>');
  process.exit(1);
}

function wavDuration(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`WAVではない: ${file}`);
  let offset = 12;
  let byteRate = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') byteRate = buf.readUInt32LE(offset + 16);
    if (id === 'data') return size / byteRate;
    offset += 8 + size + (size % 2);
  }
  throw new Error(`dataチャンクが見つからない: ${file}`);
}

const script = JSON.parse(fs.readFileSync(path.join(HERE, scriptRel), 'utf8'));

// "bg" 指定を bgClips 形式(["bg/xxx.mp4", ...])へ正規化。
// 受け付け: 文字列 or 配列。"bg/.." や ".mp4" を含めばそのまま、素の名前なら bg/<name>.mp4 に補完。
function normalizeBg(bg) {
  if (bg == null) return undefined;
  const arr = Array.isArray(bg) ? bg : [bg];
  return arr
    .filter((x) => typeof x === 'string' && x.trim())
    .map((x) => {
      let v = x.trim();
      if (!v.includes('/')) v = `bg/${v}`;
      if (!/\.\w+$/.test(v)) v = `${v}.mp4`;
      return v;
    });
}

const scenes = script.sentences.map((s, idx) => {
  const i = idx + 1;
  const audio = `${audioDir}/${String(i).padStart(2, '0')}.wav`;
  const sec = wavDuration(path.join(HERE, 'public', audio));
  const {narration, telop_style, bg, ...fields} = s;
  // 内容シンクロ背景: 文ごとの "bg"(短縮名可)or "bgClips" を優先。
  // 指定があれば bgSync=true(シーン内でその映像を順に表示=プール巡回しない)。
  const sceneBg = normalizeBg(bg) ?? s.bgClips;
  return {
    ...fields,
    // 背景動画: シーン個別指定 > 台本全体指定 > なし
    bgVideo: s.bgVideo ?? script.bgVideo ?? null,
    bgClips: sceneBg ?? script.bgClips ?? undefined,
    bgSync: sceneBg ? true : false, // true=内容シンクロ(CutBg local モード)
    bgWash: s.bgWash ?? script.bgWash ?? 0,
    audio,
    // ランキング型(RankingVideo)用: rank/saveシーンは消しゴムワイプ+SE。他テンプレでは無視される
    eraseIn: s.role === 'rank' || s.role === 'save',
    playWhoosh: s.role === 'rank',
    durationInFrames: Math.ceil(sec * FPS) + PAD_FRAMES,
  };
});

const props = {
  account: script.account ?? '',
  // BGM: 台本の "bgm" 指定 > bgm_bright.wav(あれば) > 無音
  bgm:
    script.bgm ??
    (fs.existsSync(path.join(HERE, 'public', 'bgm', 'bgm_bright.wav'))
      ? 'bgm/bgm_bright.wav'
      : ''),
  bgmVolume: script.bgmVolume ?? 0.1,
  whoosh: 'se/whoosh.wav',
  scenes,
};

fs.writeFileSync(path.join(HERE, outRel), JSON.stringify(props, null, 2));
const total = scenes.reduce((a, s) => a + s.durationInFrames, 0);
console.log(
  `${outRel} を生成: ${scenes.length}シーン / 合計 ${total}フレーム (${(total / FPS).toFixed(1)}秒)`
);
