/**
 * GAS Web App エンドポイント
 * Hotels と PriceLog（直近14日分）のデータを JSON で返す
 * ※ Config シート（API キー・メールアドレス等）は含めない
 */
function doGet(e) {
  try {
    var hotelsSheet = getSheet(SHEET_HOTELS);
    var priceLogSheet = getSheet(SHEET_PRICE_LOG);

    var hotels = getHotelsAsJson(hotelsSheet);
    var priceHistory = getPriceHistoryAsJson(priceLogSheet);

    var result = {
      updated_at: Utilities.formatDate(new Date(), 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ssXXX"),
      hotels: hotels,
      price_history: priceHistory,
    };

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Hotels シートを JSON 配列に変換する
 */
function getHotelsAsJson(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return [];

  var data = sheet.getRange(DATA_START_ROW, 1, lastRow - HEADER_ROW, COL_H.MEMO).getValues();
  var results = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var hotelNo = row[COL_H.HOTEL_NO - 1];
    if (!hotelNo) continue;

    results.push({
      hotelNo: String(hotelNo),
      hotelName: row[COL_H.HOTEL_NAME - 1],
      targetPrice: row[COL_H.TARGET_PRICE - 1] || null,
      recentAvgPrice: row[COL_H.RECENT_AVG_PRICE - 1] || null,
      enabled: !!row[COL_H.ENABLED - 1],
    });
  }

  return results;
}

/**
 * PriceLog シートを hotelNo 別の JSON に変換する（直近14日分のみ）
 */
function getPriceHistoryAsJson(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return {};

  var data = sheet.getRange(DATA_START_ROW, 1, lastRow - HEADER_ROW, COL_P.RESERVE_URL).getValues();
  var fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  var history = {};

  for (var i = 0; i < data.length; i++) {
    var fetchDate = new Date(data[i][COL_P.FETCH_DATE - 1]);
    if (fetchDate < fourteenDaysAgo) continue;

    var hotelNo = String(data[i][COL_P.HOTEL_NO - 1]);
    if (!hotelNo) continue;

    if (!history[hotelNo]) history[hotelNo] = [];
    history[hotelNo].push({
      fetchDate: Utilities.formatDate(fetchDate, 'Asia/Tokyo', 'yyyy-MM-dd'),
      stayDate: Utilities.formatDate(new Date(data[i][COL_P.STAY_DATE - 1]), 'Asia/Tokyo', 'yyyy-MM-dd'),
      charge: data[i][COL_P.CHARGE - 1],
      planName: data[i][COL_P.PLAN_NAME - 1] || '',
      discountRate: data[i][COL_P.DISCOUNT_RATE - 1] || 0,
      reviewAverage: data[i][COL_P.REVIEW_AVERAGE - 1] || 0,
      reserveUrl: data[i][COL_P.RESERVE_URL - 1] || '',
    });
  }

  return history;
}

/**
 * WebApp テスト用関数
 */
function testDoGet() {
  var result = doGet({});
  var json = JSON.parse(result.getContent());
  Logger.log(JSON.stringify(json, null, 2));
}
