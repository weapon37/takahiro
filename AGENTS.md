<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# レシート合計の集計ルール (tools/receipt-total)

レシート画像から合計を読み取って `tools/receipt-total/write-total.mjs` でスプレッドシートに
書き込む際、次の品目は食費の合計から除外する。

- 炭酸飲料
- 酒類
- 日用品（洗剤・コーヒーフィルターなど、食品ではない消耗品・雑貨）

除外した品目とその金額（推定した場合はその旨）は、書き込み後にユーザーへ内訳として提示する。

日用品として除外した金額は捨てずに合計する。

## 書き込み先セル（固定）

対象の月のシート（例: "2026.8"）に対して、次のセルへ書き込む。月が変わってもセルの
場所は同じなので、都度確認する必要はない。

- 食費の合計: B39
- 日用雑貨（日用品として除外した金額の合計）: B46

## 確認が必要なもの・不要なもの

- 炭酸飲料・酒類・日用品に該当するかどうか判断が曖昧な品目（例: 商品名だけでは
  酒類か判別できない場合）は、除外するかどうかをユーザーに確認してから合計に反映する。
- どのセルに書き込むかは上記で固定されているため、都度確認する必要はない。
- 実際にスプレッドシートへ書き込む前には、除外した品目の内訳と書き込み後の金額を
  提示し、ユーザーの確認を得てから書き込む。
