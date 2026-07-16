// script_ranking.json と public/audio_ranking/*.wav から src/props_ranking.json を生成する
// 使い方:  node tools/build_props_ranking.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FPS = 30;
const PAD_FRAMES = 6; // 各シーン末尾の余白

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

const script = JSON.parse(
  fs.readFileSync(path.join(HERE, 'script_ranking.json'), 'utf8')
);

const scenes = script.sentences.map((s, idx) => {
  const i = idx + 1;
  const audio = `audio_ranking/${String(i).padStart(2, '0')}.wav`;
  const sec = wavDuration(path.join(HERE, 'public', audio));
  return {
    audio,
    role: s.role,
    telop: s.telop,
    rank: s.rank,
    headline: s.headline,
    time: s.time,
    // 背景動画: シーン個別指定 > 台本全体指定 > なし
    bgVideo: s.bgVideo ?? script.bgVideo ?? null,
    bgWash: s.bgWash ?? script.bgWash ?? 0,
    // 順位発表と保存誘導は消しゴムワイプで場面転換(チャンネル固有演出)
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
  bgmVolume: 0.1,
  whoosh: 'se/whoosh.wav',
  scenes,
};

const outPath = path.join(HERE, 'src', 'props_ranking.json');
fs.writeFileSync(outPath, JSON.stringify(props, null, 2));
const total = scenes.reduce((a, s) => a + s.durationInFrames, 0);
console.log(
  `props_ranking.json を生成: ${scenes.length}シーン / 合計 ${total}フレーム (${(total / FPS).toFixed(1)}秒)`
);
