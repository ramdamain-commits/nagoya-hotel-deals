/**
 * スプレッドシート起動時にカスタムメニューを追加する
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('ホテル管理')
    .addItem('今すぐ価格取得', 'checkAllPrices')
    .addItem('API 接続テスト', 'testApiConnection')
    .addSeparator()
    .addItem('target_price を再調整（85%基準）', 'recalcTargetPrices')
    .addSeparator()
    .addItem('PriceLog の非土曜行を削除（ワンショット）', 'cleanupNonSaturdayPriceLog')
    .addToUi();
}

/**
 * recentAvgPrice の 85% を target_price に設定する
 * recentAvgPrice が未設定または target_price が既に85%基準以下の場合はスキップ
 */
function recalcTargetPrices() {
  var ui = SpreadsheetApp.getUi();
  var sheet = getSheet(SHEET_HOTELS);
  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return;

  var data = sheet.getRange(DATA_START_ROW, 1, lastRow - HEADER_ROW, COL_H.MEMO).getValues();
  var updated = [];

  for (var i = 0; i < data.length; i++) {
    var hotelName = data[i][COL_H.HOTEL_NAME - 1];
    var currentTarget = data[i][COL_H.TARGET_PRICE - 1];
    var avgPrice = data[i][COL_H.RECENT_AVG_PRICE - 1];
    var enabled = data[i][COL_H.ENABLED - 1];
    if (!enabled || !avgPrice) continue;

    var newTarget = Math.round(avgPrice * 0.85 / 100) * 100;
    if (currentTarget && currentTarget <= newTarget) continue;

    sheet.getRange(i + DATA_START_ROW, COL_H.TARGET_PRICE).setValue(newTarget);
    updated.push(hotelName + ': ' + currentTarget + ' -> ' + newTarget);
  }

  if (updated.length === 0) {
    ui.alert('全ホテルのtarget_priceが85%基準以下です。更新不要です。');
  } else {
    ui.alert('target_price更新完了', updated.length + '件更新:\n\n' + updated.join('\n'), ui.ButtonSet.OK);
  }
  Logger.log('target_price再調整: ' + updated.length + '件更新');
}
