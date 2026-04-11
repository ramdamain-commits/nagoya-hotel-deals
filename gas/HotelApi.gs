/**
 * 楽天トラベル空室検索 API を呼び出す
 * @param {string[]} hotelNos - 施設番号の配列（最大15件）
 * @param {string} checkinDate - チェックイン日 'YYYY-MM-DD'
 * @param {string} checkoutDate - チェックアウト日 'YYYY-MM-DD'
 * @param {Object} config - getAllConfigValues() の戻り値
 * @returns {Object} { results: Object[], errorCount: number }
 */
function searchVacantHotels(hotelNos, checkinDate, checkoutDate, config) {
  var apiKey = config['API_KEY'];
  var accessKey = config['ACCESS_KEY'];
  var adultNum = Number(config['ADULT_NUM']) || 2;
  var appUrl = config['APP_URL'] || 'https://webservice.rakuten.co.jp';

  var url = 'https://openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426'
    + '?applicationId=' + apiKey
    + '&accessKey=' + accessKey
    + '&format=json'
    + '&hotelNo=' + hotelNos.join(',')
    + '&checkinDate=' + checkinDate
    + '&checkoutDate=' + checkoutDate
    + '&adultNum=' + adultNum;

  var options = {
    muteHttpExceptions: true,
    headers: {
      'Referer': appUrl,
      'Origin': appUrl,
    },
  };
  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();

  if (statusCode === 429) {
    Logger.log('API レートリミット: 429 — スキップ');
    return { results: [], errorCount: 1 };
  }
  if (statusCode !== 200) {
    Logger.log('API エラー: HTTP ' + statusCode + ' / ' + response.getContentText().substring(0, 500));
    return { results: [], errorCount: 1 };
  }

  var json = JSON.parse(response.getContentText());
  return { results: parseVacantResponse(json, adultNum), errorCount: 0 };
}

/**
 * API レスポンスをパースし、ホテルごとの最安プランを抽出する
 * @param {Object} json - API レスポンス
 * @param {number} adultNum - 宿泊人数（chargeFlag=0 の正規化用）
 * @returns {Object[]} [{hotelNo, hotelName, planName, charge, reviewAverage, reviewCount, reserveUrl}]
 */
function parseVacantResponse(json, adultNum) {
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

    var cheapest = null;
    for (var j = 1; j < hotel.hotel.length; j++) {
      var roomInfo = hotel.hotel[j].roomInfo;
      if (!roomInfo) continue;

      // roomBasicInfo を先に1回だけ探す
      var planInfo = null;
      for (var m = 0; m < roomInfo.length; m++) {
        if (roomInfo[m].roomBasicInfo) {
          planInfo = roomInfo[m].roomBasicInfo;
          break;
        }
      }

      for (var k = 0; k < roomInfo.length; k++) {
        var item = roomInfo[k];
        if (!item.dailyCharge) continue;

        var dailyCharge = item.dailyCharge;
        var chargeFlag = dailyCharge.chargeFlag;
        var rakutenCharge = dailyCharge.rakutenCharge;

        // chargeFlag=0: 1人あたり料金 → 人数倍で1室料金に正規化
        var roomCharge = (chargeFlag === 0) ? rakutenCharge * adultNum : rakutenCharge;

        if (!cheapest || roomCharge < cheapest.charge) {
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
