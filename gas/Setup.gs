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
 * 日次トリガーを設定する（9時台と21時台に checkAllPrices を実行）
 * GAS エディタから1回だけ実行する
 */
function setupDailyTriggers() {
  // 既存トリガーを削除
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkAllPrices') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // 午前9時台トリガー
  ScriptApp.newTrigger('checkAllPrices')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  // 午後21時台トリガー
  ScriptApp.newTrigger('checkAllPrices')
    .timeBased()
    .everyDays(1)
    .atHour(21)
    .create();

  Logger.log('日次トリガー設定完了: checkAllPrices を毎日9時台・21時台に実行');
}

/**
 * Hotels シートに10ホテルを追加する（既存データは残す）
 * GAS エディタから1回だけ実行する。実行後は削除してよい。
 */
function addNewHotels() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hotels');
  var lastRow = sheet.getLastRow();

  // 行6のゲートタワーが手入力済みなら上書き含めて行6から
  var startRow = 6;

  var newHotels = [
    [158556, '名古屋JRゲートタワーホテル', 18300, '', true, '名駅直結・バストイレ別あり'],
    [163007, '名古屋プリンスホテル スカイタワー', 22500, '', true, 'ささしまライブ・全室洗い場付'],
    [187586, 'ザ ロイヤルパークホテル アイコニック 名古屋', 23400, '', true, '栄・2024年開業・全室25F以上'],
    [189164, 'ベストウェスタンプラス名古屋栄', 8500, '', true, '栄・2024年開業・コスパ◎'],
    [181187, 'イビススタイルズ名古屋', 10200, '', true, '名駅・セール変動大'],
    [171982, 'フォーポイント フレックス by シェラトン 名古屋駅前', 11900, '', true, '名駅・2024年開業・マリオット系'],
    [147710, 'ドーミーインPREMIUM名古屋栄', 13600, '', true, '栄・天然温泉大浴場'],
    [12543, '名古屋マリオットアソシアホテル', 29800, '', true, '名駅直結・52F夜景'],
    [2046, '名古屋観光ホテル', 14500, '', true, '伏見・1936年創業老舗'],
    [166257, 'DEL style 名古屋納屋橋', 10200, '', true, '伏見・全室バストイレ別・レインシャワー'],
  ];

  sheet.getRange(startRow, 1, newHotels.length, 6).setValues(newHotels);
  Logger.log('Added ' + newHotels.length + ' new hotels starting at row ' + startRow);
}

/**
 * Hotels シートに7ホテルを追加する（2026-04-12 debateレビュー通過分）
 * GAS エディタから1回だけ実行する。実行後は削除してよい。
 */
function addHotelsWave2() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hotels');
  var lastRow = sheet.getLastRow();
  var startRow = lastRow + 1;

  var newHotels = [
    [164918, 'ランプライトブックスホテル名古屋', 12000, '', true, '伏見・Books&Cafeコンセプト'],
    [167718, '西鉄ホテル クルーム名古屋', 17000, '', true, '栄・最上階露天風呂付き大浴場'],
    [177045, 'ホテル京阪 名古屋', 14000, '', true, '栄・2020年開業・ReFaシャワーヘッド'],
    [179107, '三交インGrande名古屋', 17000, '', true, '名駅・SPA付き大浴場'],
    [1659, 'ANAクラウンプラザホテルグランコート名古屋', 22000, '', true, '金山駅直結・高層夜景'],
    [144939, '三交イン名古屋錦〜四季乃湯〜', 10000, '', true, '栄・天然温泉大浴場・コメダ朝食'],
    [168599, 'ダイワロイネットホテル名古屋伏見', 12000, '', true, '伏見・大浴場・和竹コンセプト'],
  ];

  sheet.getRange(startRow, 1, newHotels.length, 6).setValues(newHotels);
  Logger.log('Wave2: Added ' + newHotels.length + ' hotels starting at row ' + startRow);
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
