// ===== シート名 =====
var SHEET_HOTELS = 'Hotels';
var SHEET_PRICE_LOG = 'PriceLog';
var SHEET_NOTIFY_LOG = 'NotifyLog';
var SHEET_CONFIG = 'Config';

// ===== Hotels シートのカラム順序（1始まり） =====
var COL_H = {
  HOTEL_NO: 1,
  HOTEL_NAME: 2,
  TARGET_PRICE: 3,
  RECENT_AVG_PRICE: 4,
  ENABLED: 5,
  MEMO: 6,
};

// ===== PriceLog シートのカラム順序（1始まり） =====
var COL_P = {
  FETCH_DATE: 1,
  STAY_DATE: 2,
  HOTEL_NO: 3,
  HOTEL_NAME: 4,
  PLAN_NAME: 5,
  CHARGE: 6,
  REVIEW_AVERAGE: 7,
  DISCOUNT_RATE: 8,
  RESERVE_URL: 9,
};

// ===== NotifyLog シートのカラム順序（1始まり） =====
var COL_N = {
  HOTEL_NO: 1,
  STAY_DATE: 2,
  NOTIFIED_AT: 3,
};

// ===== 定数 =====
var HEADER_ROW = 1;
var DATA_START_ROW = 2;

// ===== ヘルパー =====
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

function getConfigValue(key) {
  var sheet = getSheet(SHEET_CONFIG);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}
