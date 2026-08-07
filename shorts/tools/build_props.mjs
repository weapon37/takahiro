// script.json と public/audio/*.wav から、動画の設計図 (src/props.json) を自動生成する
// 使い方:  node tools/build_props.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FPS = 30;
const PAD_FRAMES = 6; // 各シーン末尾の余白(他テンプレと合わせてテンポを詰める)

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

// 話題のまとまり(1〜5)を求める。rank が来るたびに次のグループへ進む。
//   1 = フック・導入 / 2〜4 = 各項目 / 5 = CTA
// 台本のシーン数が変わっても崩れないよう、決め打ちではなく role から導く。
// 台本側で bg_group を書けば、その値を優先する。
const roles = script.sentences.map((s) => s.role);
const bgGroup = (idx) => {
  const explicit = script.sentences[idx].bg_group;
  if (explicit) return Math.min(Math.max(Number(explicit), 1), 5);
  if (roles[idx] === 'cta') return 5;
  const ranksSoFar = roles.slice(0, idx + 1).filter((r) => r === 'rank').length;
  return Math.min(1 + ranksSoFar, 5);
};

// グループごとの自前背景(実写が無いときに使われる)
const BG_MOOD = ['bokeh', 'neon', 'sale', 'rise', 'calm'];

// 実写背景(public/bg/bg_01.mp4〜bg_05.mp4)があれば話題グループごとに使う
const bgVideoFor = (idx) => {
  const rel = `bg/bg_${String(bgGroup(idx)).padStart(2, '0')}.mp4`;
  return fs.existsSync(path.join(HERE, 'public', rel)) ? rel : null;
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
    bg: BG_MOOD[bgGroup(idx) - 1],
    bgVideo: bgVideoFor(idx),
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
