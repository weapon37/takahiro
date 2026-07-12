// script.json と public/audio/*.wav から、動画の設計図 (src/props.json) を自動生成する
// 使い方:  node tools/build_props.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FPS = 30;
const PAD_FRAMES = 10; // 各シーン末尾の余白

// WAVファイルのヘッダーを読んで長さ(秒)を求める
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

const script = JSON.parse(fs.readFileSync(path.join(HERE, 'script.json'), 'utf8'));

// 話題ごとに背景の雰囲気を割り当てる(同じ話題は同じ背景で統一感を出す)
const bgByRole = (i, role) => {
  if (i <= 2) return 'fog';      // フック・導入
  if (i <= 5) return 'stars';    // 第3位(夢の話)
  if (i <= 8) return 'phone';    // 第2位(電話の話)
  if (i <= 11) return 'mirror';  // 第1位(もう一人の自分)
  return 'candle';               // CTA(占い師の部屋)
};

const scenes = script.sentences.map((s, idx) => {
  const i = idx + 1;
  const audio = `audio/${String(i).padStart(2, '0')}.wav`;
  const sec = wavDuration(path.join(HERE, 'public', audio));
  return {
    audio,
    telop: s.telop,
    telopStyle: s.telop_style ?? 'normal',
    role: s.role,
    bg: bgByRole(i, s.role),
    playWhoosh: s.role === 'rank',
    durationInFrames: Math.ceil(sec * FPS) + PAD_FRAMES,
  };
});

const props = {
  account: script.account ?? '@my_account',
  bgm: 'bgm/bgm.wav',
  bgmVolume: 0.12,
  whoosh: 'se/whoosh.wav',
  scenes,
};

const outPath = path.join(HERE, 'src', 'props.json');
fs.writeFileSync(outPath, JSON.stringify(props, null, 2));
const total = scenes.reduce((a, s) => a + s.durationInFrames, 0);
console.log(`props.json を生成: ${scenes.length}シーン / 合計 ${total}フレーム (${(total / FPS).toFixed(1)}秒)`);
