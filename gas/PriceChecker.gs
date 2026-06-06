/**
 * 全ホテルの価格を取得し、PriceLog に記録する（メインエントリポイント）
 * GAS トリガーから日次で呼び出される
 */
function checkAllPrices() {
  try {
    _checkAllPricesImpl();
  } catch (e) {
    Logger.log('バッチエラー: ' + e.message + '\n' + e.stack);
    var config = getAllConfigValues();
    var adminEmail = config['NOTIFY_EMAIL'];
    if (adminEmail) {
      GmailApp.sendEmail(adminEmail,
        '[nagoya-hotel-deals] バッチ実行エラー',
        'エラー: ' + e.message + '\n\nスタックトレース:\n' + e.stack);
    }
    throw e;
  }
}

function _checkAllPricesImpl() {
  var hotelsSheet = getSheet(SHEET_HOTELS);
  var priceLogSheet = getSheet(SHEET_PRICE_LOG);

  var lastRow = hotelsSheet.getLastRow();
  if (lastRow < DATA_START_ROW) {
    Logger.log('ホテルが登録されていません');
    return;
  }

  // Hotels マスタを読み込み（enabled のみ）
  var hotelsData = hotelsSheet.getRange(DATA_START_ROW, 1, lastRow - HEADER_ROW, COL_H.MEMO).getValues();
  var hotelNos = [];
  var hotelMap = {};

  for (var i = 0; i < hotelsData.length; i++) {
    var row = hotelsData[i];
    var hotelNo = String(row[COL_H.HOTEL_NO - 1]);
    var enabled = row[COL_H.ENABLED - 1];
    if (!hotelNo || !enabled) continue;

    hotelNos.push(hotelNo);
    hotelMap[hotelNo] = {
      rowNum: i + DATA_START_ROW,
      hotelName: row[COL_H.HOTEL_NAME - 1],
      targetPrice: row[COL_H.TARGET_PRICE - 1],
      recentAvgPrice: row[COL_H.RECENT_AVG_PRICE - 1],
    };
  }

  if (hotelNos.length === 0) {
    Logger.log('有効なホテルがありません');
    return;
  }

  Logger.log('=== 価格取得開始: ' + hotelNos.length + 'ホテル ===');

  // Config を一括取得
  var config = getAllConfigValues();
  var weeksAhead = Number(config['WEEKS_AHEAD']) || 4;
  var delayMs = Number(config['REQUEST_DELAY_MS']) || 1000;

  var now = new Date();
  var priceLogRows = [];
  var errorCount = 0;
  var successCount = 0;

  // 向こう N 週間分のうち土曜日（getDay()===6）だけを対象に取得
  var totalDays = weeksAhead * 7;
  for (var d = 0; d < totalDays; d++) {
    var checkin = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    // 土曜泊（土曜チェックイン）のみ対象。それ以外はスキップ
    if (checkin.getDay() !== 6) continue;
    var checkout = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d + 1);
    var checkinStr = formatDate(checkin);
    var checkoutStr = formatDate(checkout);

    Logger.log('取得中(土): ' + checkinStr + ' (' + (d + 1) + '/' + totalDays + ')');

    // API は最大15件同時指定。超える場合はバッチ分割
    var batchSize = 15;
    var dayResults = [];
    var dayError = false;
    for (var b = 0; b < hotelNos.length; b += batchSize) {
      var batch = hotelNos.slice(b, b + batchSize);
      var apiResult = searchVacantHotels(batch, checkinStr, checkoutStr, config);
      if (apiResult.errorCount > 0) {
        errorCount += apiResult.errorCount;
        dayError = true;
        break;
      }
      dayResults = dayResults.concat(apiResult.results);
      // バッチ間ディレイ
      if (b + batchSize < hotelNos.length) Utilities.sleep(delayMs);
    }
    if (dayError) continue;
    successCount++;
    var results = dayResults;
    for (var r = 0; r < results.length; r++) {
      var plan = results[r];
      var hotel = hotelMap[plan.hotelNo];
      if (!hotel) continue;

      var discountRate = calcDiscountRate(plan.charge, hotel.recentAvgPrice, hotel.targetPrice);

      priceLogRows.push([
        now,
        checkin,
        plan.hotelNo,
        plan.hotelName,
        plan.planName,
        plan.charge,
        plan.reviewAverage,
        discountRate,
        plan.reserveUrl,
      ]);
    }

    // レートリミット対策
    if (d < totalDays - 1) {
      Utilities.sleep(delayMs);
    }
  }

  // PriceLog にバッチ書き込み
  if (priceLogRows.length > 0) {
    var startRow = priceLogSheet.getLastRow() + 1;
    priceLogSheet.getRange(startRow, 1, priceLogRows.length, priceLogRows[0].length).setValues(priceLogRows);
  }

  // recentAvgPrice を更新
  updateRecentAvgPrices(hotelsSheet, priceLogSheet, hotelMap);

  Logger.log('=== 完了: ' + priceLogRows.length + '件記録, 成功' + successCount + '日/失敗' + errorCount + '日 ===');
}

/**
 * 割安率を算出する
 * @param {number} charge - 当日料金
 * @param {number} avgPrice - 30日平均（null ならフォールバック）
 * @param {number} targetPrice - 目標価格（フォールバック用）
 * @returns {number} 割安率（%）。正=割安、負=割高
 */
function calcDiscountRate(charge, avgPrice, targetPrice) {
  var base = avgPrice || targetPrice;
  if (!base || base <= 0) return 0;
  return Math.round((base - charge) / base * 1000) / 10;
}

/**
 * Hotels シートの recentAvgPrice を更新する
 */
function updateRecentAvgPrices(hotelsSheet, priceLogSheet, hotelMap) {
  var logLastRow = priceLogSheet.getLastRow();
  if (logLastRow < DATA_START_ROW) return;

  var logData = priceLogSheet.getRange(DATA_START_ROW, 1, logLastRow - HEADER_ROW, COL_P.CHARGE).getValues();
  var thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  var hotelDailyMin = {};

  for (var i = 0; i < logData.length; i++) {
    var fetchDate = new Date(logData[i][COL_P.FETCH_DATE - 1]);
    if (fetchDate < thirtyDaysAgo) continue;

    // 土曜泊のみを平均に含める（過去の平日残存データを除外。'u': 6=土）
    var dow = Utilities.formatDate(new Date(logData[i][COL_P.STAY_DATE - 1]), 'Asia/Tokyo', 'u');
    if (dow !== '6') continue;

    var hotelNo = String(logData[i][COL_P.HOTEL_NO - 1]);
    var charge = logData[i][COL_P.CHARGE - 1];
    if (!charge) continue;

    var dateKey = formatDate(fetchDate);
    if (!hotelDailyMin[hotelNo]) hotelDailyMin[hotelNo] = {};
    if (!hotelDailyMin[hotelNo][dateKey] || charge < hotelDailyMin[hotelNo][dateKey]) {
      hotelDailyMin[hotelNo][dateKey] = charge;
    }
  }

  for (var hn in hotelMap) {
    var dailyMins = hotelDailyMin[hn];
    if (!dailyMins) continue;

    var sum = 0;
    var count = 0;
    for (var dk in dailyMins) {
      sum += dailyMins[dk];
      count++;
    }
    if (count > 0) {
      var avg = Math.round(sum / count);
      hotelsSheet.getRange(hotelMap[hn].rowNum, COL_H.RECENT_AVG_PRICE).setValue(avg);
    }
  }
}

/**
 * 日付を 'YYYY-MM-DD' 形式にフォーマットする
 */
function formatDate(date) {
  var y = date.getFullYear();
  var m = ('0' + (date.getMonth() + 1)).slice(-2);
  var d = ('0' + date.getDate()).slice(-2);
  return y + '-' + m + '-' + d;
}
