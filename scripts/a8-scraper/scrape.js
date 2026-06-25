/**
 * A8.net の案件(プログラム)をキーワード検索し、
 *   ・案件名／ジャンル
 *   ・報酬額（単価）
 *   ・提携形態（即時 or 審査）
 *   ・承認条件
 *   ・確定率
 * を CSV にまとめるローカル実行用スクリプト。
 *
 * ログインIDやパスワードはコード中に書かず、環境変数または対話的なログイン操作で渡すこと。
 *
 * 使い方:
 *   cd scripts/a8-scraper
 *   npm install
 *   A8_KEYWORD="転職エージェント" npm run scrape
 *
 * ログインは既定で「手動」(ブラウザが開くのでその場でログインし、Enterキーで続行)。
 * captcha や二段階認証があってもこの方式なら対応できる。
 *
 * A8.net のページ構造は把握しきれていない（このセッションからはネットワーク制限で
 * A8.net に接続できないため未検証）。一覧の見え方が想定と違う場合に備えて、
 * 各ページのスクリーンショットとHTML/テキストダンプを output/ 以下に保存するので、
 * 抽出がうまくいかない場合はそれを見ながら下記 SELECTORS / 抽出ロジックを調整すること。
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const A8_ID = process.env.A8_ID || '';
const A8_PASS = process.env.A8_PASS || '';
const AUTO_LOGIN = process.env.A8_AUTO_LOGIN === 'true'; // 既定は手動ログイン
const KEYWORD = process.env.A8_KEYWORD || '転職エージェント';
const MAX_PAGES = Number(process.env.A8_MAX_PAGES || 10);
const HEADLESS = process.env.A8_HEADLESS === 'true'; // 既定はブラウザ表示(false)
const OUT_DIR = path.join(__dirname, 'output');

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function waitForEnter(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(promptText, () => {
      rl.close();
      resolve();
    });
  });
}

function csvEscape(value) {
  const s = (value ?? '').toString().replace(/\r?\n/g, ' / ');
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(rows, headers) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  // Excel で日本語が文字化けしないように UTF-8 BOM を付与
  return '﻿' + lines.join('\n') + '\n';
}

// 一覧ページから「即時」「審査」バッジを起点にカードらしき要素を抽出する。
// A8.net のマークアップは未確認のためヒューリスティック実装。
async function extractListCards(page) {
  return page.evaluate(() => {
    const badgeTexts = ['即時', '即時提携', '審査', '要審査', '審査制'];
    const all = Array.from(document.querySelectorAll('body *'));
    const badgeEls = all.filter((el) => {
      if (el.children.length > 0) return false;
      const t = (el.textContent || '').trim();
      return badgeTexts.includes(t);
    });

    const seen = new Set();
    const cards = [];
    for (const badge of badgeEls) {
      let container = badge;
      for (let i = 0; i < 8 && container.parentElement; i++) {
        container = container.parentElement;
        if ((container.textContent || '').trim().length > 80) break;
      }
      if (seen.has(container)) continue;
      seen.add(container);

      const link = container.querySelector('a[href]');
      cards.push({
        typeText: badge.textContent.trim(),
        name: link ? link.textContent.trim().replace(/\s+/g, ' ') : '',
        url: link ? link.href : '',
        fullText: (container.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 2000),
      });
    }
    return cards;
  });
}

// 詳細ページ本文テキストから「ラベルの直後の値」を取り出すヒューリスティック。
async function extractLabelValue(page, label) {
  return page.evaluate((label) => {
    const all = Array.from(document.querySelectorAll('body *'));
    for (const el of all) {
      const t = (el.textContent || '').trim();
      if (t === label || (t.startsWith(label) && t.length <= label.length + 6)) {
        const candidates = [el.nextElementSibling, el.parentElement && el.parentElement.nextElementSibling];
        for (const c of candidates) {
          if (c && c.textContent && c.textContent.trim()) {
            return c.textContent.replace(/\s+/g, ' ').trim().slice(0, 300);
          }
        }
      }
    }
    return '';
  }, label);
}

async function extractRewardText(fullText) {
  const m = fullText.match(/[¥￥]\s?[\d,]+(?:円)?|\d[\d,]*\s?円/);
  return m ? m[0] : '';
}

async function extractConfirmRate(fullText) {
  const m = fullText.match(/確定率[^\d%]{0,10}([\d.]+%\s?[~〜\-]\s?[\d.]+%|[\d.]+%)/);
  return m ? m[1] : '';
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: HEADLESS, slowMo: HEADLESS ? 0 : 50 });
  const page = await browser.newPage();

  await page.goto('https://www.a8.net/', { waitUntil: 'domcontentloaded' });

  if (AUTO_LOGIN && A8_ID && A8_PASS) {
    console.log('自動ログインを試みます（マークアップ未検証のため失敗する可能性があります）。');
    try {
      const idInput = page.locator('input[type="text"], input[name*="id" i], input[name*="login" i]').first();
      const passInput = page.locator('input[type="password"]').first();
      await idInput.fill(A8_ID);
      await passInput.fill(A8_PASS);
      await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        passInput.press('Enter'),
      ]);
    } catch (e) {
      console.warn('自動ログインに失敗しました。手動でログインしてください。', e.message);
    }
  }

  if (!AUTO_LOGIN || !A8_ID || !A8_PASS) {
    console.log('開いたブラウザで A8.net にログインしてください。');
    await waitForEnter('ログインが完了したら Enter キーを押してください... ');
  }

  // プログラム検索への遷移（テキストリンクをクリック。見つからない場合は手動操作を促す）
  try {
    const searchLink = page.getByRole('link', { name: /プログラム検索/ }).first();
    await searchLink.click({ timeout: 5000 });
    await page.waitForLoadState('domcontentloaded');
  } catch (e) {
    console.log('「プログラム検索」リンクを自動で見つけられませんでした。');
    await waitForEnter('プログラム検索のページまで自分で移動したら Enter キーを押してください... ');
  }

  // キーワード検索
  try {
    const keywordInput = page
      .locator('input[type="search"], input[name*="keyword" i], input[placeholder*="キーワード"], input[placeholder*="フリーワード"]')
      .first();
    await keywordInput.fill(KEYWORD);
    await keywordInput.press('Enter');
    await page.waitForLoadState('domcontentloaded');
  } catch (e) {
    console.log('検索キーワード入力欄を自動で見つけられませんでした。');
    await waitForEnter(`「${KEYWORD}」で検索した状態にしてから Enter キーを押してください... `);
  }

  const allCards = [];
  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, `list-page${pageNum}.png`), fullPage: true });
    fs.writeFileSync(path.join(OUT_DIR, `list-page${pageNum}.html`), await page.content());

    const cards = await extractListCards(page);
    console.log(`page ${pageNum}: ${cards.length} 件のカードらしき要素を検出`);
    allCards.push(...cards);

    const nextLink = page.getByRole('link', { name: /次へ|次のページ|Next/ }).first();
    const hasNext = await nextLink.count();
    if (!hasNext) break;
    try {
      await nextLink.click({ timeout: 5000 });
      await page.waitForLoadState('domcontentloaded');
    } catch (e) {
      break;
    }
  }

  // 重複URL除去
  const uniqueByUrl = new Map();
  for (const c of allCards) {
    const key = c.url || c.name;
    if (key && !uniqueByUrl.has(key)) uniqueByUrl.set(key, c);
  }

  const rows = [];
  for (const card of uniqueByUrl.values()) {
    const row = {
      '案件名': card.name,
      'ジャンル': KEYWORD,
      '報酬額（単価）': await extractRewardText(card.fullText),
      '提携形態': card.typeText.includes('即時') ? '即時' : '審査',
      '承認条件': '',
      '確定率': await extractConfirmRate(card.fullText),
      'URL': card.url,
      '備考（一覧テキスト）': card.fullText,
    };

    if (card.url) {
      try {
        const detail = await browser.newPage();
        await detail.goto(card.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const bodyText = await detail.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
        if (!row['承認条件']) {
          row['承認条件'] = (await extractLabelValue(detail, '承認条件')) || '';
        }
        if (!row['確定率']) {
          row['確定率'] = (await extractConfirmRate(bodyText)) || '';
        }
        if (!row['報酬額（単価）']) {
          row['報酬額（単価）'] = (await extractRewardText(bodyText)) || '';
        }
        await detail.close();
      } catch (e) {
        console.warn(`詳細ページの取得に失敗: ${card.url} (${e.message})`);
      }
    }

    rows.push(row);
  }

  const headers = ['案件名', 'ジャンル', '報酬額（単価）', '提携形態', '承認条件', '確定率', 'URL', '備考（一覧テキスト）'];
  const csv = toCsv(rows, headers);
  const outPath = path.join(OUT_DIR, `a8-recruitment-${ts()}.csv`);
  fs.writeFileSync(outPath, csv);

  console.log(`\n完了: ${rows.length} 件を ${outPath} に出力しました。`);
  console.log('「承認条件」「確定率」が空欄の行は、抽出ロジックが現在のページ構造に合っていない可能性があります。');
  console.log(`output/ 内の list-page*.html / list-page*.png を見ながら scrape.js の抽出ロジックを調整してください。`);

  await browser.close();
})().catch((e) => {
  console.error('エラーが発生しました:', e);
  process.exit(1);
});
