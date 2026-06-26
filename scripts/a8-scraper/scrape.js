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
 *   A8_KEYWORD="AI" npm run scrape
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
const KEYWORD = process.env.A8_KEYWORD || 'AI';
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

// 一覧ページの各カードは「プログラムID／プログラム開始日／カテゴリ／成果報酬／EPC／確定率／関連キーワード」
// という決まったラベルの並びを持つ。プログラムIDの出現位置でカード区切りとし、
// 各ラベルの直後（DOM上の次のテキスト要素）を値として取り出す。
// （実機のスクリーンショットで確認した構造に基づく）
async function extractListCards(page) {
  return page.evaluate(() => {
    const LABELS = ['プログラムID', 'プログラム開始日', 'カテゴリ', '成果報酬', 'EPC', '確定率', '関連キーワード'];
    const TITLE_BLACKLIST = new Set([
      '未提携', '提携中', '提携申請中', '本人NG', 'ポイントNG', 'リスティング一部OK', '商品リンク',
      '審査あり', 'セルフバック', 'スマホ最適化', 'ITP対応', '7days', 'マネー', 'マネタイズ',
      'アイコンについて', '広告主サイト', '広告サンプル', 'プログラム詳細を見る', '一括提携する',
      'プログラムの一括提携', '検索条件の変更', 'プログラム情報の見方', '★', '☆',
    ]);

    function isLeaf(el) {
      return el.children.length === 0 && (el.textContent || '').trim().length > 0;
    }
    const leaves = Array.from(document.querySelectorAll('body *')).filter(isLeaf);
    const items = leaves.map((el) => ({ text: el.textContent.trim(), el }));

    // ラベルの直後に「ⓘ」等のツールチップアイコンが独立した要素として挟まることがある
    // （例: 「確定率」の次の leaf がアイコンで、本当の値はその次にある）。
    // 数字を含まない短いトークンはアイコン/区切りとみなして読み飛ばす。
    function isIconOrNoise(t) {
      return t.length <= 2 && !/[0-9]/.test(t);
    }
    function findValueAfter(i) {
      for (let j = i + 1; j < items.length && j <= i + 4; j++) {
        const t = items[j].text;
        if (LABELS.includes(t)) break;
        if (isIconOrNoise(t)) continue;
        return j;
      }
      return i + 1 < items.length ? i + 1 : -1;
    }

    function finalizeTitle(card, recentTexts) {
      const filtered = recentTexts.filter(
        (t) => !TITLE_BLACKLIST.has(t) && !LABELS.includes(t) && t.length >= 4
      );
      if (filtered.length === 0) return;
      let best = filtered[0];
      for (const t of filtered) if (t.length > best.length) best = t;
      card.name = best;
      const others = filtered.filter((t) => t !== best);
      card.company = others.length ? others[others.length - 1] : '';
    }

    // ラベル自身とその直後の値（ラベルに紐づくテキスト）は、次カードのタイトル推測を
    // 汚染しないよう recentTexts には積まない。
    const consumed = new Array(items.length).fill(false);
    for (let i = 0; i < items.length; i++) {
      if (LABELS.includes(items[i].text)) {
        consumed[i] = true;
        const valueIdx = findValueAfter(i);
        const end = valueIdx === -1 ? i + 1 : valueIdx;
        for (let k = i + 1; k <= end && k < items.length; k++) consumed[k] = true;
      }
    }

    const cards = [];
    let current = null;
    let recentTexts = [];

    for (let i = 0; i < items.length; i++) {
      const { text, el } = items[i];

      if (text === 'プログラムID') {
        if (current) cards.push(current);
        current = { name: '', company: '', category: '', reward: '', confirmRate: '', detailUrl: '', hasReview: false };
        finalizeTitle(current, recentTexts);
        recentTexts = [];
      }

      if (current) {
        if (LABELS.includes(text)) {
          const valueIdx = findValueAfter(i);
          const value = valueIdx !== -1 && items[valueIdx] ? items[valueIdx].text : '';
          if (text === 'カテゴリ') current.category = value;
          if (text === '成果報酬') current.reward = value;
          if (text === '確定率') current.confirmRate = value;
        } else {
          if (text.includes('審査')) current.hasReview = true;
          const a = el.closest('a');
          if (a && a.textContent.trim() === 'プログラム詳細を見る' && a.href) {
            current.detailUrl = a.href;
            // この案件のまとまりはここで終わり。以降は次カードのタイトル候補とみなす。
            recentTexts = [];
          }
        }
      }

      if (!consumed[i]) {
        recentTexts.push(text);
        if (recentTexts.length > 20) recentTexts.shift();
      }
    }
    if (current) cards.push(current);

    // 「確定率」の th には ⓘ ツールチップ用の <a> 等の子要素が混在しており、
    // 単独の leaf としては出現しない（実機HTMLで確認: <tr><th>確定率<span><a>...
    // </a></span></th><td>98.63%</td></tr>）。th.textContent は子要素のテキストも
    // 連結されるため、テーブル行 (tr > th/td) から直接読み取る方が確実。
    // 各カードの情報テーブルは先頭行が「プログラムID」になっているテーブルとして識別し、
    // カードの出現順とテーブルの出現順が一致することを前提に対応付ける。
    const tableConfirmRates = [];
    document.querySelectorAll('table').forEach((table) => {
      const rows = Array.from(table.querySelectorAll('tr'));
      const firstLabel = rows[0] && rows[0].querySelector('th');
      if (!firstLabel || firstLabel.textContent.trim() !== 'プログラムID') return;
      let rate = '';
      for (const tr of rows) {
        const th = tr.querySelector('th');
        const td = tr.querySelector('td');
        if (th && td && th.textContent.trim() === '確定率') {
          rate = td.textContent.trim();
          break;
        }
      }
      tableConfirmRates.push(rate);
    });

    return cards.map((c, idx) => ({
      name: c.name,
      company: c.company,
      category: c.category,
      reward: c.reward,
      confirmRate: tableConfirmRates[idx] || c.confirmRate,
      type: c.hasReview ? '審査' : '即時',
      url: c.detailUrl,
    }));
  });
}

// 詳細ページでも一覧と同様の「ラベル→直後の値」という並びを仮定して取り出す。
// （詳細ページの構造は未確認のためヒューリスティック。取れない場合は空文字を返す）
// 案件詳細ページを開く際、A8.net側のセキュリティ仕様で「ログイン再認証」(パスワード再入力)
// を求められることがある。自動化できないため、いったん止めて手動で再認証してもらう。
// <title> はSPA側のページ遷移より更新が遅れることがあったため、本文テキストで判定する。
async function isReauthPage(page) {
  try {
    const text = await page.evaluate(() => document.body.innerText || '');
    return text.includes('再認証');
  } catch (e) {
    return false;
  }
}

async function handleReauthIfNeeded(page, originalUrl) {
  if (!(await isReauthPage(page))) return false;
  console.log('\nA8.net から再認証(パスワードの再入力)を求められました。');
  await waitForEnter('開いているブラウザで再認証を完了したら Enter キーを押してください... ');
  await page.goto(originalUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);
  return true;
}

// SPAのページ遷移が落ち着くまで何度か確認し、その都度 再認証ページなら対処する。
async function settleDetailPage(page, originalUrl) {
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(800);
    await handleReauthIfNeeded(page, originalUrl);
  }
}

async function extractLabelValue(page, label) {
  return page.evaluate((label) => {
    // まずテーブル行 (tr > th/td) を探す。一覧ページの確定率と同様に、ラベル側の
    // th にツールチップアイコン等が混在していても th.textContent なら拾える。
    const rows = Array.from(document.querySelectorAll('tr'));
    for (const tr of rows) {
      const th = tr.querySelector('th');
      const td = tr.querySelector('td');
      if (th && td) {
        const t = th.textContent.trim();
        if (t === label || (t.startsWith(label) && t.length <= label.length + 6)) {
          return td.textContent.trim().slice(0, 300);
        }
      }
    }

    // テーブル構造でない場合のフォールバック: テキストのみの leaf 要素を直後の値とみなす。
    function isLeaf(el) {
      return el.children.length === 0 && (el.textContent || '').trim().length > 0;
    }
    function isIconOrNoise(t) {
      return t.length <= 2 && !/[0-9]/.test(t);
    }
    const leaves = Array.from(document.querySelectorAll('body *')).filter(isLeaf);
    for (let i = 0; i < leaves.length; i++) {
      const t = leaves[i].textContent.trim();
      if (t === label || (t.startsWith(label) && t.length <= label.length + 6)) {
        for (let j = i + 1; j < leaves.length && j <= i + 4; j++) {
          const v = leaves[j].textContent.trim();
          if (isIconOrNoise(v)) continue;
          return v.slice(0, 300);
        }
        return '';
      }
    }
    return '';
  }, label);
}

// 詳細ページには見出し付きの「承認条件」セクションは存在しないが、ページに埋め込まれた
// JSONデータ（&quot;remarks&quot;:&quot;...&quot;）の中に、承認条件に近い説明文が
// 入っている（実機HTMLで確認: 「・このプログラムは◯◯でサービスを初購入するユーザーを
// 獲得していただくプログラムです。」等）。これをDOM経由ではなく生HTMLから直接取り出す。
function extractRemarksFromHtml(html) {
  const m = html.match(/&quot;remarks&quot;:&quot;(.*?)&quot;,&quot;/);
  if (!m) return '';
  return m[1]
    .replace(/\\r\\n/g, ' / ')
    .replace(/\\"/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim()
    .slice(0, 300);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: HEADLESS, slowMo: HEADLESS ? 0 : 50 });
  // browser.newPage() が作る暗黙のコンテキストは1ページ専用で、そこから
  // 2つ目のページを開こうとすると "Please use browser.newContext()" で失敗する。
  // 詳細ページをログイン状態を共有した別タブで開けるよう、明示的にコンテキストを作る。
  const context = await browser.newContext();
  const page = await context.newPage();

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
      'ジャンル': card.category || KEYWORD,
      '広告主': card.company,
      '報酬額（単価）': card.reward,
      '提携形態': card.type,
      '承認条件': '',
      '確定率': card.confirmRate,
      'URL': card.url,
    };

    if (card.url) {
      try {
        // browser.newPage() は新しい(ログインCookieを持たない)ブラウザコンテキストを
        // 作ってしまうため、ログイン済みの page と同じコンテキストから新規タブを開く。
        const detail = await page.context().newPage();
        await detail.goto(card.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await settleDetailPage(detail, card.url);
        const detailHtml = await detail.content();
        // 承認条件の抽出ロジックが詳細ページの実際の構造と合っているか確認するため、
        // 最初の2件だけ詳細ページのHTMLを保存する（デバッグ用）。
        if (rows.length < 2) {
          fs.writeFileSync(path.join(OUT_DIR, `detail-sample-${rows.length}.html`), detailHtml);
        }
        row['承認条件'] = extractRemarksFromHtml(detailHtml) || (await extractLabelValue(detail, '承認条件')) || '';
        await detail.close();
      } catch (e) {
        console.warn(`詳細ページの取得に失敗: ${card.url} (${e.message})`);
      }
    }

    rows.push(row);
  }

  const headers = ['案件名', 'ジャンル', '広告主', '報酬額（単価）', '提携形態', '承認条件', '確定率', 'URL'];
  const csv = toCsv(rows, headers);
  const outPath = path.join(OUT_DIR, `a8-${KEYWORD}-${ts()}.csv`);
  fs.writeFileSync(outPath, csv);

  console.log(`\n完了: ${rows.length} 件を ${outPath} に出力しました。`);
  console.log('「承認条件」「確定率」が空欄の行は、抽出ロジックが現在のページ構造に合っていない可能性があります。');
  console.log(`output/ 内の list-page*.html / list-page*.png を見ながら scrape.js の抽出ロジックを調整してください。`);

  await browser.close();
})().catch((e) => {
  console.error('エラーが発生しました:', e);
  process.exit(1);
});
