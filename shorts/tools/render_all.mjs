// Week 1一括レンダリング: scripts/*.json を 音声生成→props→render まで通しで処理する
// 使い方:
//   GOOGLE_TTS_API_KEY=xxxx node tools/render_all.mjs           # 全台本
//   GOOGLE_TTS_API_KEY=xxxx node tools/render_all.mjs day1_am_best5  # 1本だけ
//
// ルール:
// - ◯◯(プレースホルダ)が残っている台本はスキップ(実データに差し替えてから)
// - 音声は「台本が音声より新しい」場合のみ再生成(TTS課金の節約)
// - コンポジションは台本の "template" フィールドで決まる
import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(HERE);

const only = process.argv[2];
const files = fs
  .readdirSync('scripts')
  .filter((f) => f.endsWith('.json'))
  .filter((f) => !only || f === `${only}.json`)
  .sort();

if (files.length === 0) {
  console.error(only ? `scripts/${only}.json が見つかりません` : 'scripts/ に台本がありません');
  process.exit(1);
}

const run = (cmd) => execSync(cmd, {stdio: 'inherit'});
const results = [];

for (const f of files) {
  const slug = f.replace(/\.json$/, '');
  const scriptPath = `scripts/${f}`;
  const raw = fs.readFileSync(scriptPath, 'utf8');
  const script = JSON.parse(raw);

  if (raw.includes('◯◯') || raw.includes('◯分') || raw.includes('◯秒')) {
    console.log(`⏭  SKIP ${slug}: プレースホルダ(◯◯)が未差し替え`);
    results.push([slug, 'SKIP(要差し替え)']);
    continue;
  }
  if (!script.template) {
    console.log(`⏭  SKIP ${slug}: "template" フィールドがありません`);
    results.push([slug, 'SKIP(template無し)']);
    continue;
  }

  const audioDir = `public/audio_${slug}`;
  const propsPath = `src/props_${slug}.json`;
  const outPath = `out/${slug}.mp4`;

  console.log(`\n=== ${slug} (${script.template}) ===`);

  // 音声: 無い or 台本の方が新しいときだけ生成
  const needVoice =
    !fs.existsSync(audioDir) ||
    fs.statSync(scriptPath).mtimeMs > fs.statSync(audioDir).mtimeMs;
  if (needVoice) {
    run(`.venv/bin/python tools/make_voice_google.py ${scriptPath} ${audioDir}`);
    fs.utimesSync(audioDir, new Date(), new Date());
  } else {
    console.log('音声: 既存を再利用');
  }

  run(`node tools/build_props_generic.mjs ${scriptPath} audio_${slug} ${propsPath}`);
  run(
    `npx remotion render src/index.ts ${script.template} ${outPath} --props=${propsPath} --codec=h264`
  );
  const mb = (fs.statSync(outPath).size / 1e6).toFixed(1);
  results.push([slug, `OK ${mb}MB`]);
}

console.log('\n===== 結果 =====');
for (const [slug, r] of results) console.log(`${slug.padEnd(18)} ${r}`);
