// レジ締め報告フォームの回答を zaiko-app に自動転送する Google Apps Script。
//
// 【設置手順】
// 1. レジ締め報告の回答スプレッドシートを開く
// 2. メニュー「拡張機能」→「Apps Script」を開く
// 3. このファイルの中身を全部貼り付けて保存（プロジェクト名は自由）
// 4. 左側の時計アイコン「トリガー」→「トリガーを追加」で以下を設定:
//    - 実行する関数: onFormSubmit
//    - イベントのソース: スプレッドシートから
//    - イベントの種類: フォーム送信時
//    - 保存（初回はGoogleの承認画面が出るので許可する）
// 5. 過去の回答もまとめて送りたい場合は、エディタ上部で syncAll を選んで「実行」を1回押す

const ENDPOINT = 'https://zaiko-app-vert.vercel.app/api/sync/register-closings';
const SYNC_SECRET = 'ここにREGISTER_SYNC_SECRETと同じ値を貼る';

// フォームの質問名（フォームの項目名を変えた場合はここも合わせる）
const COL = {
  date: '日付',
  store: '店舗',
  openingChange: 'オープン時釣り銭',
  adjustment: '修正',
  overShort: '過不足',
  deposit: '預入',
  carriedOver: '繰越',
  photo: 'レシート写真',
  staff: '担当者',
};

function onFormSubmit(e) {
  const v = e.namedValues;
  const get = (name) => (v[name] && v[name][0]) || '';
  sendRow({
    row_id: get('タイムスタンプ'),
    date: get(COL.date),
    store: get(COL.store),
    opening_change: get(COL.openingChange),
    adjustment: get(COL.adjustment),
    over_short: get(COL.overShort),
    deposit: get(COL.deposit),
    carried_over: get(COL.carriedOver),
    receipt_photo_url: get(COL.photo),
    staff_name: get(COL.staff),
  });
}

// 過去の回答を全件送信する（初回に手動で1回だけ実行）
function syncAll() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(String);
  const idx = (name) => header.indexOf(name);

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const cell = (name) => {
      const j = idx(name);
      return j === -1 ? '' : String(row[j]);
    };
    if (!cell(COL.date)) continue;
    sendRow({
      row_id: cell('タイムスタンプ'),
      date: cell(COL.date),
      store: cell(COL.store),
      opening_change: cell(COL.openingChange),
      adjustment: cell(COL.adjustment),
      over_short: cell(COL.overShort),
      deposit: cell(COL.deposit),
      carried_over: cell(COL.carriedOver),
      receipt_photo_url: cell(COL.photo),
      staff_name: cell(COL.staff),
    });
    Utilities.sleep(200); // 連続送信しすぎないように少し待つ
  }
}

function sendRow(payload) {
  const res = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-sync-secret': SYNC_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  console.log(res.getResponseCode() + ': ' + res.getContentText());
}
