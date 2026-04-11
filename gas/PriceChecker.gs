/**
 * 全ホテルの価格を取得し、PriceLog に記録する（メインエントリポイント）
 * GAS トリガーから日次で呼び出される
 */
function checkAllPrices() {
  var ss = getSpreadsheet();
  var hotelsSheet = getSheet(SHEET_HOTELS);
  var priceLogSheet = getSheet(SHEET_PRICE_LOG);
  var notifyLogSheet = getSheet(SHEET_NOTIFY_LOG);

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
    if (!hotelNo || enabled === false || enabled === 'FALSE') continue;

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

  var weeksAhead = getConfigValue('WEEKS_AHEAD') || 4;
  var delayMs = getConfigValue('REQUEST_DELAY_MS') || 1000;
  var now = new Date();
  var deals = [];
  var totalRecords = 0;

  // 向こう N 週間分を日付ごとに取得
  for (var d = 0; d < weeksAhead * 7; d++) {
    var checkin = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    var checkout = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d + 1);
    var checkinStr = formatDate(checkin);
    var checkoutStr = formatDate(checkout);

    Logger.log('取得中: ' + checkinStr + ' (' + (d + 1) + '/' + (weeksAhead * 7) + ')');

    var results = searchVacantHotels(hotelNos, checkinStr, checkoutStr);

    // PriceLog に記録
    for (var r = 0; r < results.length; r++) {
      var plan = results[r];
      var hotel = hotelMap[plan.hotelNo];
      if (!hotel) continue;

      // 割安率を算出
      var discountRate = calcDiscountRate(plan.charge, hotel.recentAvgPrice, hotel.targetPrice);

      priceLogSheet.appendRow([
        now,               // fetchDate
        checkin,           // stayDate
        plan.hotelNo,      // hotelNo
        plan.hotelName,    // hotelName
        plan.planName,     // planName
        plan.charge,       // charge
        plan.reviewAverage,// reviewAverage
        discountRate,      // discountRate
        plan.reserveUrl,   // reserveUrl
      ]);
      totalRecords++;

      // 通知判定
      var dealInfo = checkDeal(plan, hotel, discountRate, checkin, notifyLogSheet, now);
      if (dealInfo) deals.push(dealInfo);
    }

    // レートリミット対策
    if (d < weeksAhead * 7 - 1) {
      Utilities.sleep(delayMs);
    }
  }

  // recentAvgPrice を更新
  updateRecentAvgPrices(hotelsSheet, priceLogSheet, hotelMap);

  // 通知送信
  if (deals.length > 0) {
    sendDealNotifications(deals);
  }

  Logger.log('=== 完了: ' + totalRecords + '件記録, ' + deals.length + '件通知 ===');
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
  return Math.round((base - charge) / base * 1000) / 10; // 小数点1桁
}

/**
 * 通知判定: targetPrice 以下 or 割安率が閾値以上
 */
function checkDeal(plan, hotel, discountRate, stayDate, notifyLogSheet, now) {
  var targetPrice = hotel.targetPrice;
  var discountThreshold = getConfigValue('DISCOUNT_THRESHOLD_PCT') || 20;
  var cooldownHours = getConfigValue('COOLDOWN_HOURS') || 24;

  var isBelowTarget = targetPrice && plan.charge <= targetPrice;
  var isHighDiscount = discountRate >= discountThreshold;

  if (!isBelowTarget && !isHighDiscount) return null;

  // クールダウンチェック（NotifyLog）
  if (isNotifiedRecently(notifyLogSheet, plan.hotelNo, stayDate, cooldownHours, now)) {
    return null;
  }

  // NotifyLog に記録
  notifyLogSheet.appendRow([plan.hotelNo, stayDate, now]);

  return {
    hotelName: plan.hotelName,
    hotelNo: plan.hotelNo,
    stayDate: stayDate,
    planName: plan.planName,
    charge: plan.charge,
    targetPrice: targetPrice,
    discountRate: discountRate,
    reviewAverage: plan.reviewAverage,
    reviewCount: plan.reviewCount,
    reserveUrl: plan.reserveUrl,
  };
}

/**
 * NotifyLog で最近通知済みかチェックする
 */
function isNotifiedRecently(notifyLogSheet, hotelNo, stayDate, cooldownHours, now) {
  var lastRow = notifyLogSheet.getLastRow();
  if (lastRow < DATA_START_ROW) return false;

  var data = notifyLogSheet.getRange(DATA_START_ROW, 1, lastRow - HEADER_ROW, COL_N.NOTIFIED_AT).getValues();
  var stayDateStr = formatDate(stayDate);

  for (var i = data.length - 1; i >= 0; i--) {
    if (String(data[i][COL_N.HOTEL_NO - 1]) !== String(hotelNo)) continue;
    var logStayDate = formatDate(new Date(data[i][COL_N.STAY_DATE - 1]));
    if (logStayDate !== stayDateStr) continue;

    var notifiedAt = new Date(data[i][COL_N.NOTIFIED_AT - 1]);
    var elapsedHours = (now.getTime() - notifiedAt.getTime()) / (1000 * 60 * 60);
    if (elapsedHours < cooldownHours) return true;
  }
  return false;
}

/**
 * Hotels シートの recentAvgPrice を更新する
 * 定義: 直近30日間の fetchDate における、そのホテルの最安 charge の平均
 */
function updateRecentAvgPrices(hotelsSheet, priceLogSheet, hotelMap) {
  var logLastRow = priceLogSheet.getLastRow();
  if (logLastRow < DATA_START_ROW) return;

  var logData = priceLogSheet.getRange(DATA_START_ROW, 1, logLastRow - HEADER_ROW, COL_P.CHARGE).getValues();
  var thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // hotelNo → { fetchDateStr → minCharge }
  var hotelDailyMin = {};

  for (var i = 0; i < logData.length; i++) {
    var fetchDate = new Date(logData[i][COL_P.FETCH_DATE - 1]);
    if (fetchDate < thirtyDaysAgo) continue;

    var hotelNo = String(logData[i][COL_P.HOTEL_NO - 1]);
    var charge = logData[i][COL_P.CHARGE - 1];
    if (!charge) continue;

    var dateKey = formatDate(fetchDate);
    if (!hotelDailyMin[hotelNo]) hotelDailyMin[hotelNo] = {};
    if (!hotelDailyMin[hotelNo][dateKey] || charge < hotelDailyMin[hotelNo][dateKey]) {
      hotelDailyMin[hotelNo][dateKey] = charge;
    }
  }

  // 平均を計算して Hotels シートに書き込む
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
