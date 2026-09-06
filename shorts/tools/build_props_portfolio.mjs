// 横型ポートフォリオ(PortfolioVideo)用の props ビルダー
// 使い方: node tools/build_props_portfolio.mjs <台本.json> <出力props.json> [音声dir(public内)]
// 例:     node tools/build_props_portfolio.mjs scripts/portfolio_master.json src/props_portfolio.json
//         node tools/build_props_portfolio.mjs scripts/portfolio_master.json src/props_portfolio.json audio_portfolio
//
// 縦型の build_props_generic.mjs との違い:
//   - 音声なし(無音・テロップ主体)でも組める。尺は各シーンの "sec" で決まる
//   - 音声dirを渡した場合はwavの実長を優先し、"sec" は下限として効く
//     (HP埋め込みはミュート自動再生が多いため、無音でも成立する尺にしておく)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FPS = 30;
const PAD_FRAMES = 12; // 読み終わり〜カット切り替えの余白
const DEFAULT_SEC = 4;

const [scriptRel, outRel, audioDir] = process.argv.slice(2);
if (!scriptRel || !outRel) {
  console.error('使い方: node tools/build_props_portfolio.mjs <台本.json> <出力props.json> [音声dir]');
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

const scenes = script.sentences.map((s, idx) => {
  const {narration, sec, ...fields} = s;
  const minSec = sec ?? DEFAULT_SEC;
  let audio = null;
  let seconds = minSec;
  if (audioDir) {
    const rel = `${audioDir}/${String(idx + 1).padStart(2, '0')}.wav`;
    const abs = path.join(HERE, 'public', rel);
    if (fs.existsSync(abs)) {
      audio = rel;
      seconds = Math.max(minSec, wavDuration(abs) + PAD_FRAMES / FPS);
    } else {
      console.warn(`音声が無いので "sec" を使用: ${rel}`);
    }
  }
  return {
    ...fields,
    bgVideo: s.bgVideo ?? script.bgVideo ?? null,
    bgClips: s.bgClips ?? script.bgClips ?? undefined,
    bgWash: s.bgWash ?? script.bgWash ?? 0,
    audio,
    durationInFrames: Math.ceil(seconds * FPS),
  };
});

const props = {
  account: script.account ?? '',
  subtitle: script.subtitle ?? '',
  bgm: script.bgm ?? '',
  bgmVolume: script.bgmVolume ?? 0.1,
  scenes,
};

fs.writeFileSync(path.join(HERE, outRel), JSON.stringify(props, null, 2));
const total = scenes.reduce((a, s) => a + s.durationInFrames, 0);
console.log(
  `${outRel} を生成: ${scenes.length}シーン / 合計 ${total}フレーム (${(total / FPS).toFixed(1)}秒)` +
    (total / FPS > 60 ? ' ⚠ 60秒を超えています' : '')
);
