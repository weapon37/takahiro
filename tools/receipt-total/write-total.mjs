#!/usr/bin/env node
/**
 * 領収書の合計金額を Google スプレッドシートの指定セルに書き込む。
 * 書き込み先の Apps Script ウェブアプリは tools/receipt-total/Code.gs を参照。
 *
 * 必要な環境変数:
 *   SHEETS_WEBAPP_URL           デプロイしたウェブアプリの URL (.../exec)
 *   SHEETS_WEBAPP_SECRET        スクリプトプロパティ SHARED_SECRET と同じ文字列
 *   SHEETS_DEFAULT_SPREADSHEET  任意。--spreadsheet 省略時の書き込み先
 *
 * 使い方:
 *   # 現在値を確認する (書き込まない)
 *   node tools/receipt-total/write-total.mjs --inspect
 *   node tools/receipt-total/write-total.mjs --sheet 2026-08 --cell B12 --inspect
 *
 *   # 書き込む
 *   node tools/receipt-total/write-total.mjs --sheet 2026-08 --cell B12 --value 12480
 *
 *   # 別のスプレッドシートを対象にする
 *   node tools/receipt-total/write-total.mjs --spreadsheet <URL> --sheet 2026-08 --cell B12 --value 12480
 *
 *   # セルを空にする
 *   node tools/receipt-total/write-total.mjs --sheet 2026-08 --cell B12 --clear
 *
 *   # 月のシートをテンプレートから作る (既定テンプレート: 原本（改）)
 *   node tools/receipt-total/write-total.mjs --sheet 2026-09 --create-sheet
 *   node tools/receipt-total/write-total.mjs --sheet 2026-09 --create-sheet --template 原本（改）
 *
 *   # 書き込まずに結果だけ見る
 *   node tools/receipt-total/write-total.mjs ... --dry-run
 */

const FLAGS_WITH_VALUE = new Set(['--spreadsheet', '--sheet', '--cell', '--value', '--template']);

function parseArgs(argv) {
  const args = { dryRun: false, inspect: false, clear: false, createSheet: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--dry-run') {
      args.dryRun = true;
    } else if (flag === '--inspect') {
      args.inspect = true;
    } else if (flag === '--clear') {
      args.clear = true;
    } else if (flag === '--create-sheet') {
      args.createSheet = true;
    } else if (FLAGS_WITH_VALUE.has(flag)) {
      const value = argv[++i];
      if (value === undefined) {
        throw new Error(`${flag} に値が指定されていません`);
      }
      args[flag.slice(2)] = value;
    } else {
      throw new Error(`不明な引数です: ${flag}`);
    }
  }
  return args;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return value;
}

function formatYen(value) {
  return typeof value === 'number' ? `${value.toLocaleString('ja-JP')} 円` : String(value);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // タブが毎月増えるだけの台帳では書き込み先が変わらないため、既定値を環境変数に置ける。
  const spreadsheet = args.spreadsheet || process.env.SHEETS_DEFAULT_SPREADSHEET;
  if (!spreadsheet) {
    throw new Error(
      '書き込み先が不明です。--spreadsheet でスプレッドシートの URL か ID を指定するか、' +
        '環境変数 SHEETS_DEFAULT_SPREADSHEET を設定してください'
    );
  }
  if (!args.inspect && !args.createSheet) {
    if (!args.cell) {
      throw new Error('--cell は必須です (確認だけなら --inspect)');
    }
    if (!args.clear && args.value === undefined) {
      throw new Error('--value は必須です (確認だけなら --inspect、空にするだけなら --clear)');
    }
  }
  if (args.createSheet && !args.sheet) {
    throw new Error('--create-sheet には --sheet で新しいシート名の指定が必須です');
  }

  const url = requireEnv('SHEETS_WEBAPP_URL');
  const secret = requireEnv('SHEETS_WEBAPP_SECRET');

  const action = args.inspect ? 'inspect' : args.createSheet ? 'createSheet' : args.clear ? 'clear' : 'write';
  const payload = {
    secret,
    action,
    spreadsheet,
    sheet: args.sheet,
    cell: args.cell,
    dryRun: args.dryRun,
  };
  if (action === 'write') {
    const amount = Number(String(args.value).replace(/[,\s]/g, ''));
    if (!Number.isFinite(amount)) {
      throw new Error(`--value が数値ではありません: ${args.value}`);
    }
    payload.value = amount;
  }
  if (action === 'createSheet' && args.template) {
    payload.template = args.template;
  }

  // Apps Script の /exec は googleusercontent へリダイレクトするため redirect: follow が要る。
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(
      `ウェブアプリからの応答が JSON ではありません (HTTP ${response.status})。` +
        `デプロイ設定「アクセスできるユーザー: 全員」を確認してください。\n${text.slice(0, 500)}`
    );
  }

  if (!result.ok) {
    throw new Error(result.error || '不明なエラー');
  }

  if (result.action === 'inspect') {
    console.log(`スプレッドシート: ${result.spreadsheetName}`);
    console.log(`シート一覧: ${result.sheetNames.join(', ')}`);
    if (result.sheetName) {
      console.log(`対象シート: ${result.sheetName}`);
    }
    if (result.cell) {
      const current = result.currentValue === '' ? '(空)' : formatYen(result.currentValue);
      console.log(`${result.cell} の現在値: ${current}`);
      if (result.currentFormula) {
        console.log(`${result.cell} の数式: ${result.currentFormula}`);
      }
    }
    return;
  }

  if (result.action === 'createSheet') {
    if (result.dryRun) {
      console.log(`[dry-run] ${result.spreadsheetName} にシート「${result.sheetName}」を作成 (テンプレート: ${result.templateSheet}) (未実行)`);
      return;
    }
    console.log(`シートを作成しました: ${result.spreadsheetName} / ${result.sheetName} (テンプレート: ${result.templateSheet})`);
    return;
  }

  const target = `${result.spreadsheetName} / ${result.sheetName} / ${result.cell}`;
  const before = result.previousValue === null ? '(空)' : formatYen(result.previousValue);

  if (result.action === 'clear') {
    if (result.dryRun) {
      console.log(`[dry-run] ${target}`);
      console.log(`  ${before} → (空) (未実行)`);
      return;
    }
    console.log(`空にしました: ${target}`);
    console.log(`  ${before} → (空)`);
    if (result.previousFormula) {
      console.log(`  注意: 数式 ${result.previousFormula} を消去しました`);
    }
    return;
  }

  const after = formatYen(result.writtenValue);

  if (result.dryRun) {
    console.log(`[dry-run] ${target}`);
    console.log(`  ${before} → ${after} (未書き込み)`);
    return;
  }

  console.log(`書き込み完了: ${target}`);
  console.log(`  ${before} → ${after}`);
  if (result.previousFormula) {
    console.log(`  注意: 数式 ${result.previousFormula} を上書きしました`);
  }
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exitCode = 1;
});
