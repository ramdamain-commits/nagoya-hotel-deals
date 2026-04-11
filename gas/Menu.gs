/**
 * スプレッドシート起動時にカスタムメニューを追加する
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('ホテル管理')
    .addItem('今すぐ価格取得', 'checkAllPrices')
    .addItem('API 接続テスト', 'testApiConnection')
    .addSeparator()
    .addItem('通知ログをクリア', 'clearNotifyLog')
    .addToUi();
}

/**
 * NotifyLog シートの全データを削除する
 */
function clearNotifyLog() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    '通知ログクリア',
    'NotifyLog の全データを削除しますか？\nクールダウンがリセットされ、次回取得時に通知が再送されます。',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  var sheet = getSheet(SHEET_NOTIFY_LOG);
  var lastRow = sheet.getLastRow();
  if (lastRow >= DATA_START_ROW) {
    sheet.deleteRows(DATA_START_ROW, lastRow - HEADER_ROW);
  }
  ui.alert('NotifyLog をクリアしました');
}
