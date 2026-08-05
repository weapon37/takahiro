// 一括レンダリング: scripts/ 配下の台本を 音声生成→props→render まで通しで処理する
// 使い方:
//   GOOGLE_TTS_API_KEY=xxxx node tools/render_all.mjs                  # 全チャンネルの全台本
//   GOOGLE_TTS_API_KEY=xxxx node tools/render_all.mjs home             # homeチャンネルだけ
//   GOOGLE_TTS_API_KEY=xxxx node tools/render_all.mjs day1_am_best5    # 1本だけ
//   GOOGLE_TTS_API_KEY=xxxx node tools/render_all.mjs home_day1_am_naiken5
//
// チャンネルの分け方:
//   scripts/xxx.json        → slug "xxx"        (既定チャンネル=仕事が消えるAI帳)
//   scripts/home/xxx.json   → slug "home_xxx"   (引っ越し・住宅チャンネル)
// slugがそのまま音声(public/audio_<slug>)・props(src/props_<slug>.json)・
// 出力(out/<slug>.mp4)の名前になるので、チャンネル間でファイルが衝突しない。
//
// ルール:
// - ◯◯(プレースホルダ)が残っている台本はスキップ(実データに差し替えてから)
// - 音声は「台本が音声より新しい」場合のみ再生成(TTS課金の節約)
// - コンポジションは台本の "template" フィールドで決まる
// - 配色・マスコットは台本の "brand" フィールドで決まる
import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(HERE);

// scripts/ を再帰的に走査し、scripts/ からの相対パスを返す
const walk = (dir) =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return e.name.endsWith('.json') ? [path.relative('scripts', full)] : [];
  });

const slugOf = (rel) => rel.replace(/\.json$/, '').split(path.sep).join('_');

const only = process.argv[2];
const files = walk('scripts')
  .filter((rel) => {
    if (!only) return true;
    // 台本名(slug)そのもの、またはチャンネル名(ディレクトリ)で絞り込む
    return slugOf(rel) === only || rel.split(path.sep)[0] === only;
  })
  .sort();

if (files.length === 0) {
  console.error(
    only ? `scripts/ に "${only}" に該当する台本がありません` : 'scripts/ に台本がありません'
  );
  process.exit(1);
}

const run = (cmd) => execSync(cmd, {stdio: 'inherit'});
const results = [];

for (const f of files) {
  const slug = slugOf(f);
  const scriptPath = `scripts/${f.split(path.sep).join('/')}`;
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
for (const [slug, r] of results) console.log(`${slug.padEnd(26)} ${r}`);
