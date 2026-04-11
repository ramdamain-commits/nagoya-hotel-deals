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
  // 楽天 API は Referer/Origin に楽天コンソール登録サイトを要求する
  var refererUrl = config['APP_URL'] || 'https://script.google.com';

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
      'Referer': refererUrl,
      'Origin': refererUrl,
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

/**
 * API 接続テスト: ホテル1件・1日分だけ取得して結果を表示する
 * GAS エディタまたはメニューから実行する
 */
function testApiConnection() {
  var config = getAllConfigValues();
  var hotelsSheet = getSheet(SHEET_HOTELS);
  var lastRow = hotelsSheet.getLastRow();
  if (lastRow < DATA_START_ROW) {
    Logger.log('テスト失敗: Hotels シートにデータがありません');
    return;
  }

  // 最初の enabled ホテルを取得
  var data = hotelsSheet.getRange(DATA_START_ROW, 1, lastRow - HEADER_ROW, COL_H.ENABLED).getValues();
  var testHotelNo = null;
  for (var i = 0; i < data.length; i++) {
    if (data[i][COL_H.HOTEL_NO - 1] && data[i][COL_H.ENABLED - 1]) {
      testHotelNo = String(data[i][COL_H.HOTEL_NO - 1]);
      break;
    }
  }
  if (!testHotelNo) {
    Logger.log('テスト失敗: 有効なホテルがありません');
    return;
  }

  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 7);
  var dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  Logger.log('=== API 接続テスト ===');
  Logger.log('ホテル番号: ' + testHotelNo);
  Logger.log('チェックイン: ' + formatDate(tomorrow));
  Logger.log('Referer: ' + (config['APP_URL'] || 'https://script.google.com'));

  var result = searchVacantHotels([testHotelNo], formatDate(tomorrow), formatDate(dayAfter), config);

  if (result.errorCount > 0) {
    Logger.log('★ API エラー — ログの HTTP ステータスを確認してください');
  } else if (result.results.length === 0) {
    Logger.log('★ API 成功だが空室なし（正常動作）');
  } else {
    var p = result.results[0];
    Logger.log('★ API 成功!');
    Logger.log('  ホテル: ' + p.hotelName);
    Logger.log('  プラン: ' + p.planName);
    Logger.log('  料金: ' + p.charge + '円');
  }
}
