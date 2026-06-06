// ===== シート名 =====
const SHEET_HOTELS = 'Hotels';
const SHEET_PRICE_LOG = 'PriceLog';
const SHEET_CONFIG = 'Config';

// ===== Hotels シートのカラム順序（1始まり） =====
const COL_H = Object.freeze({
  HOTEL_NO: 1,
  HOTEL_NAME: 2,
  TARGET_PRICE: 3,
  RECENT_AVG_PRICE: 4,
  ENABLED: 5,
  MEMO: 6,
});

// ===== PriceLog シートのカラム順序（1始まり） =====
const COL_P = Object.freeze({
  FETCH_DATE: 1,
  STAY_DATE: 2,
  HOTEL_NO: 3,
  HOTEL_NAME: 4,
  PLAN_NAME: 5,
  CHARGE: 6,
  REVIEW_AVERAGE: 7,
  DISCOUNT_RATE: 8,
  RESERVE_URL: 9,
});

// ===== 定数 =====
const HEADER_ROW = 1;
const DATA_START_ROW = 2;

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

/**
 * Config シートの全設定を一括取得する
 * @returns {Object} キー→値のマップ
 */
function getAllConfigValues() {
  var sheet = getSheet(SHEET_CONFIG);
  var data = sheet.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) config[data[i][0]] = data[i][1];
  }
  return config;
}
