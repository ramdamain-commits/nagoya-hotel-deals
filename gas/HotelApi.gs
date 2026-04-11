/**
 * 楽天トラベル空室検索 API を呼び出す
 * @param {string[]} hotelNos - 施設番号の配列（最大15件）
 * @param {string} checkinDate - チェックイン日 'YYYY-MM-DD'
 * @param {string} checkoutDate - チェックアウト日 'YYYY-MM-DD'
 * @returns {Object[]} ホテルごとの最安プラン情報の配列
 */
function searchVacantHotels(hotelNos, checkinDate, checkoutDate) {
  var apiKey = getConfigValue('API_KEY');
  var adultNum = getConfigValue('ADULT_NUM') || 2;

  var url = 'https://app.rakuten.co.jp/services/api/Travel/VacantHotelSearch/20170426'
    + '?applicationId=' + apiKey
    + '&format=json'
    + '&hotelNo=' + hotelNos.join(',')
    + '&checkinDate=' + checkinDate
    + '&checkoutDate=' + checkoutDate
    + '&adultNum=' + adultNum;

  var options = { muteHttpExceptions: true };
  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();

  if (statusCode === 429) {
    Logger.log('API レートリミット: 429 — スキップ');
    return [];
  }
  if (statusCode !== 200) {
    Logger.log('API エラー: HTTP ' + statusCode);
    return [];
  }

  var json = JSON.parse(response.getContentText());
  return parseVacantResponse(json);
}

/**
 * API レスポンスをパースし、ホテルごとの最安プランを抽出する
 * @param {Object} json - API レスポンス
 * @returns {Object[]} [{hotelNo, hotelName, planName, charge, reviewAverage, reviewCount, reserveUrl}]
 */
function parseVacantResponse(json) {
  var results = [];
  var hotels = json.hotels;
  if (!hotels || !hotels.length) return results;

  for (var i = 0; i < hotels.length; i++) {
    var hotel = hotels[i];
    var hotelInfo = hotel.hotel[0].hotelBasicInfo;
    var hotelNo = String(hotelInfo.hotelNo);
    var hotelName = hotelInfo.hotelName;
    var reviewAverage = hotelInfo.reviewAverage || 0;
    var reviewCount = hotelInfo.reviewCount || 0;

    // 全プランから最安を探す
    var cheapest = null;
    for (var j = 1; j < hotel.hotel.length; j++) {
      var roomInfo = hotel.hotel[j].roomInfo;
      if (!roomInfo) continue;

      for (var k = 0; k < roomInfo.length; k++) {
        var item = roomInfo[k];
        if (!item.dailyCharge) continue;

        var dailyCharge = item.dailyCharge;
        var chargeFlag = dailyCharge.chargeFlag;
        var rakutenCharge = dailyCharge.rakutenCharge;

        // 1室あたりに正規化
        var roomCharge = (chargeFlag === 0) ? rakutenCharge * 2 : rakutenCharge;

        if (!cheapest || roomCharge < cheapest.charge) {
          var planInfo = null;
          for (var m = 0; m < roomInfo.length; m++) {
            if (roomInfo[m].roomBasicInfo) {
              planInfo = roomInfo[m].roomBasicInfo;
              break;
            }
          }
          cheapest = {
            hotelNo: hotelNo,
            hotelName: hotelName,
            planName: planInfo ? planInfo.planName : '',
            charge: roomCharge,
            reviewAverage: reviewAverage,
            reviewCount: reviewCount,
            reserveUrl: planInfo ? (planInfo.reserveUrl || '') : '',
          };
        }
      }
    }

    if (cheapest) {
      results.push(cheapest);
    }
  }

  return results;
}
