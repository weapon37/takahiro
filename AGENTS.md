<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# レシート合計の集計ルール (tools/receipt-total)

レシート画像から合計を読み取って `tools/receipt-total/write-total.mjs` でスプレッドシートに
書き込む際、次の品目は合計から除外する。

- 炭酸飲料
- 酒類

除外した品目とその金額（推定した場合はその旨）は、書き込み後にユーザーへ内訳として提示する。
