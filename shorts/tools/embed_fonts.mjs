// フォントTTFをbase64でソースコードに埋め込む(ブラウザのフォント取得が
// プロキシ環境で固まる問題の回避策)
// 使い方:  node tools/embed_fonts.mjs  →  src/fonts.ts を生成
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FONTS = [
  ['ZEN_MARU_BLACK', 'public/fonts/ZenMaruGothic-Black.ttf'],
  ['ZEN_MARU_BOLD', 'public/fonts/ZenMaruGothic-Bold.ttf'],
];

let out = '// 自動生成ファイル(node tools/embed_fonts.mjs で再生成)\n';
for (const [name, rel] of FONTS) {
  const b64 = fs.readFileSync(path.join(HERE, rel)).toString('base64');
  out += `export const ${name} = 'data:font/ttf;base64,${b64}';\n`;
}
fs.writeFileSync(path.join(HERE, 'src', 'fonts.ts'), out);
console.log('src/fonts.ts を生成しました');
