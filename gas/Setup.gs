/**
 * 初回セットアップ: シート作成・ヘッダー・Config 初期値
 * GAS エディタから1回だけ実行する。実行後は削除してよい。
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // シート1を Hotels にリネーム
  var sheet1 = ss.getSheets()[0];
  sheet1.setName('Hotels');
  sheet1.getRange('A1:F1').setValues([['hotelNo', 'hotelName', 'targetPrice', 'recentAvgPrice', 'enabled', 'memo']]);
  sheet1.getRange('A1:F1').setFontWeight('bold');

  // PriceLog シート作成
  var pl = ss.insertSheet('PriceLog');
  pl.getRange('A1:I1').setValues([['fetchDate', 'stayDate', 'hotelNo', 'hotelName', 'planName', 'charge', 'reviewAverage', 'discountRate', 'reserveUrl']]);
  pl.getRange('A1:I1').setFontWeight('bold');

  // NotifyLog シート作成
  var nl = ss.insertSheet('NotifyLog');
  nl.getRange('A1:C1').setValues([['hotelNo', 'stayDate', 'notifiedAt']]);
  nl.getRange('A1:C1').setFontWeight('bold');

  // Config シート作成
  var cf = ss.insertSheet('Config');
  cf.getRange('A1:B1').setValues([['key', 'value']]);
  cf.getRange('A1:B1').setFontWeight('bold');
  cf.getRange('A2:B8').setValues([
    ['API_KEY', '4dfa6e9e-fee0-4101-8d6a-f8b3f1b146de'],
    ['ADULT_NUM', 2],
    ['WEEKS_AHEAD', 4],
    ['NOTIFY_EMAIL', 'ramdamain@gmail.com'],
    ['REQUEST_DELAY_MS', 1000],
    ['COOLDOWN_HOURS', 24],
    ['DISCOUNT_THRESHOLD_PCT', 20]
  ]);

  Logger.log('Setup complete: Hotels, PriceLog, NotifyLog, Config');
}

/**
 * Hotels シートにテスト用ホテルを登録する
 */
function seedHotels() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hotels');

  // 既存データをクリア（ヘッダー以外）
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 6).clearContent();
  }

  // ホテルデータを書き込み
  var hotels = [
    [172380, 'ホテル・アンドルームス名古屋伏見', 10000, '', true, '伏見駅徒歩3分'],
    [183489, 'コートヤード・バイ・マリオット名古屋', 15000, '', true, '伏見エリア'],
    [181850, 'FORZA ホテルフォルツァ名古屋栄', 12000, '', true, '栄エリア'],
    [179617, 'ニッコースタイル名古屋', 14000, '', true, '名駅エリア'],
  ];

  sheet.getRange(2, 1, hotels.length, 6).setValues(hotels);
  Logger.log('Hotels seeded: ' + hotels.length + ' hotels');
}

/**
 * Config シートに ACCESS_KEY を追加する
 */
function addAccessKey() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, 2).setValues([['ACCESS_KEY', 'pk_SlYleYALTERtLPDxdm7sqO7uaUZNQOQ5MbmXgeBcVfQ']]);
  Logger.log('ACCESS_KEY added to Config');
}
