/**
 * 領収書の合計金額を Google スプレッドシートの指定セルに書き込むウェブアプリ。
 *
 * デプロイ時に「次のユーザーとして実行: 自分」「アクセスできるユーザー: 全員」を選ぶ。
 * 自分として実行されるため、自分が編集権限を持つシートならどれでも書き込める。
 * 認証はスクリプトプロパティ SHARED_SECRET による共有シークレットで行う。
 *
 * リクエスト (POST, JSON):
 *   {
 *     "secret":      "共有シークレット",
 *     "action":      "write" | "inspect",   // 省略時は write
 *     "spreadsheet": "スプレッドシートの URL または ID",
 *     "sheet":       "シート名",            // 省略時は先頭シート
 *     "cell":        "B12",                 // write では必須
 *     "value":       12480,                 // write では必須
 *     "dryRun":      false                  // true なら書き込まず結果だけ返す
 *   }
 */

var SECRET_PROPERTY = 'SHARED_SECRET';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOutput_({ ok: false, error: 'リクエストボディが空です' });
    }

    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return jsonOutput_({ ok: false, error: 'JSON の解析に失敗しました: ' + parseError.message });
    }

    var expected = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);
    if (!expected) {
      return jsonOutput_({
        ok: false,
        error: 'スクリプトプロパティ ' + SECRET_PROPERTY + ' が未設定です',
      });
    }
    if (!secretMatches_(body.secret, expected)) {
      return jsonOutput_({ ok: false, error: '認証に失敗しました' });
    }

    var action = body.action || 'write';
    if (action === 'inspect') {
      return jsonOutput_(inspect_(body));
    }
    if (action === 'write') {
      return jsonOutput_(write_(body));
    }
    return jsonOutput_({ ok: false, error: '不明な action です: ' + action });
  } catch (error) {
    return jsonOutput_({ ok: false, error: error.message });
  }
}

/** デプロイ確認用。シークレットを URL に載せずに済むよう、情報は返さない。 */
function doGet() {
  return jsonOutput_({ ok: true, message: 'receipt-total web app is running' });
}

/**
 * シート一覧と対象セルの現在値を返す。書き込みは行わない。
 * シートが毎月変わる運用で、当月のシート名を確認するために使う。
 */
function inspect_(body) {
  var spreadsheet = openSpreadsheet_(body.spreadsheet);
  var sheetNames = spreadsheet.getSheets().map(function (sheet) {
    return sheet.getName();
  });

  var result = {
    ok: true,
    action: 'inspect',
    spreadsheetName: spreadsheet.getName(),
    spreadsheetId: spreadsheet.getId(),
    sheetNames: sheetNames,
  };

  if (body.sheet || body.cell) {
    var sheet = resolveSheet_(spreadsheet, body.sheet);
    result.sheetName = sheet.getName();
    if (body.cell) {
      var range = resolveCell_(sheet, body.cell);
      result.cell = range.getA1Notation();
      result.currentValue = range.getValue();
      result.currentFormula = range.getFormula() || null;
    }
  }

  return result;
}

/** 指定セルに値を書き込む。書き込み前の値も返すので、上書きかどうか呼び出し側で判断できる。 */
function write_(body) {
  if (body.cell === undefined || body.cell === null || body.cell === '') {
    return { ok: false, error: 'cell が指定されていません' };
  }
  if (body.value === undefined || body.value === null || body.value === '') {
    return { ok: false, error: 'value が指定されていません' };
  }

  var value = Number(body.value);
  if (!isFinite(value)) {
    return { ok: false, error: 'value が数値ではありません: ' + body.value };
  }

  var spreadsheet = openSpreadsheet_(body.spreadsheet);
  var sheet = resolveSheet_(spreadsheet, body.sheet);
  var range = resolveCell_(sheet, body.cell);

  var previousValue = range.getValue();
  var previousFormula = range.getFormula() || null;
  var dryRun = body.dryRun === true;

  if (!dryRun) {
    range.setValue(value);
    SpreadsheetApp.flush();
  }

  return {
    ok: true,
    action: 'write',
    dryRun: dryRun,
    spreadsheetName: spreadsheet.getName(),
    spreadsheetId: spreadsheet.getId(),
    sheetName: sheet.getName(),
    cell: range.getA1Notation(),
    previousValue: previousValue === '' ? null : previousValue,
    previousFormula: previousFormula,
    writtenValue: value,
  };
}

function openSpreadsheet_(spreadsheetRef) {
  if (!spreadsheetRef) {
    throw new Error('spreadsheet (URL または ID) が指定されていません');
  }
  var ref = String(spreadsheetRef).trim();
  try {
    if (ref.indexOf('http') === 0) {
      return SpreadsheetApp.openByUrl(ref);
    }
    return SpreadsheetApp.openById(ref);
  } catch (error) {
    throw new Error('スプレッドシートを開けませんでした (' + ref + '): ' + error.message);
  }
}

function resolveSheet_(spreadsheet, sheetName) {
  if (!sheetName) {
    return spreadsheet.getSheets()[0];
  }
  var sheet = spreadsheet.getSheetByName(String(sheetName).trim());
  if (!sheet) {
    var available = spreadsheet.getSheets().map(function (s) {
      return s.getName();
    });
    throw new Error(
      'シートが見つかりません: ' + sheetName + ' / 利用可能なシート: ' + available.join(', ')
    );
  }
  return sheet;
}

function resolveCell_(sheet, cell) {
  var range;
  try {
    range = sheet.getRange(String(cell).trim());
  } catch (error) {
    throw new Error('セルの指定が不正です: ' + cell);
  }
  if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) {
    throw new Error('セルは 1 つだけ指定してください: ' + cell);
  }
  return range;
}

/** 長さと内容を突き合わせる比較。早期 return を避けて時間差を減らす。 */
function secretMatches_(provided, expected) {
  if (typeof provided !== 'string') {
    return false;
  }
  if (provided.length !== expected.length) {
    return false;
  }
  var mismatch = 0;
  for (var i = 0; i < expected.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
