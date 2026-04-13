/**
 * お得通知メールを送信する（ホテル単位でグルーピング）
 * @param {Object[]} deals - 通知対象のプラン情報配列
 */
function sendDealNotifications(deals) {
  var notifyEmail = getConfigValue('NOTIFY_EMAIL');
  if (!notifyEmail) return;

  // ホテル単位でグルーピング（出現順を保持）
  var hotelOrder = [];
  var hotelGroups = {};
  for (var i = 0; i < deals.length; i++) {
    var deal = deals[i];
    var key = deal.hotelNo;
    if (!hotelGroups[key]) {
      hotelGroups[key] = { hotelName: deal.hotelName, deals: [] };
      hotelOrder.push(key);
    }
    hotelGroups[key].deals.push(deal);
  }

  var subject = '[nagoya-hotel-deals] ' + hotelOrder.length + '施設 ' + deals.length + '件のお得プラン';
  var bodyParts = [];
  var hotelIdx = 0;

  for (var h = 0; h < hotelOrder.length; h++) {
    var group = hotelGroups[hotelOrder[h]];
    var hotelLines = [];
    hotelLines.push('== ' + group.hotelName + ' (' + group.deals.length + '件) ==');

    for (var j = 0; j < group.deals.length; j++) {
      var d = group.deals[j];
      var stayDateObj = toLocalDate(d.stayDate);
      var dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][stayDateObj.getDay()];

      hotelIdx++;
      var lines = [];
      lines.push('  ' + hotelIdx + '. ' + formatDate(stayDateObj) + ' (' + dayOfWeek + ')');
      lines.push('     プラン: ' + d.planName);

      if (d.targetPrice && d.charge <= d.targetPrice) {
        var savings = d.targetPrice - d.charge;
        lines.push('     料金: ' + d.charge + '円（目標: ' + d.targetPrice + '円 / ' + savings + '円 お得）');
      } else {
        lines.push('     料金: ' + d.charge + '円（割安率: ' + d.discountRate + '%）');
      }

      lines.push('     評点: ' + d.reviewAverage + ' (' + d.reviewCount + '件)');

      if (d.reserveUrl) {
        lines.push('     予約: ' + d.reserveUrl);
      }

      hotelLines.push(lines.join('\n'));
    }

    bodyParts.push(hotelLines.join('\n'));
  }

  var footer = '\n\n---\nダッシュボード: https://ramdamain-commits.github.io/nagoya-hotel-deals/';
  GmailApp.sendEmail(notifyEmail, subject, bodyParts.join('\n\n') + footer);
  Logger.log(deals.length + '件(' + hotelOrder.length + '施設)の通知メールを送信しました');
}

/**
 * stayDate を Date オブジェクトに変換する（UTC ズレ回避）
 */
function toLocalDate(stayDate) {
  if (stayDate instanceof Date) return stayDate;
  var parts = String(stayDate).split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

/**
 * テスト用: ダミーデータで通知メールを送信する（メールフォーマット確認用）
 * GASエディタから手動実行する
 */
function testSendNotification() {
  var deals = [
    { hotelName: 'ホテル・アンドルームス名古屋伏見', hotelNo: '172380', stayDate: '2026-04-19', planName: 'シンプルステイ（素泊り）', charge: 7500, targetPrice: 8100, discountRate: 21.1, reviewAverage: 4.2, reviewCount: 150, reserveUrl: 'https://example.com/1' },
    { hotelName: 'ホテル・アンドルームス名古屋伏見', hotelNo: '172380', stayDate: '2026-04-26', planName: 'シンプルステイ（素泊り）', charge: 7800, targetPrice: 8100, discountRate: 17.9, reviewAverage: 4.2, reviewCount: 150, reserveUrl: 'https://example.com/2' },
    { hotelName: 'FORZA ホテルフォルツァ名古屋栄', hotelNo: '181850', stayDate: '2026-04-19', planName: 'お得な素泊りプラン', charge: 6900, targetPrice: 7700, discountRate: 25.4, reviewAverage: 4.3, reviewCount: 200, reserveUrl: 'https://example.com/3' },
    { hotelName: 'ベストウェスタンプラス名古屋栄', hotelNo: '189164', stayDate: '2026-04-20', planName: '朝食付きプラン', charge: 4800, targetPrice: 5400, discountRate: 23.8, reviewAverage: 4.0, reviewCount: 80, reserveUrl: 'https://example.com/4' },
  ];
  sendDealNotifications(deals);
  Logger.log('テスト通知を送信しました');
}
