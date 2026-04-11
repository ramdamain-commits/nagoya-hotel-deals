/**
 * お得通知メールを送信する
 * @param {Object[]} deals - 通知対象のプラン情報配列
 */
function sendDealNotifications(deals) {
  var notifyEmail = getConfigValue('NOTIFY_EMAIL');
  if (!notifyEmail) return;

  for (var i = 0; i < deals.length; i++) {
    var deal = deals[i];
    var stayDateObj = new Date(deal.stayDate);
    var dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][stayDateObj.getDay()];
    var stayDateStr = (stayDateObj.getMonth() + 1) + '/' + stayDateObj.getDate() + '(' + dayOfWeek + ')';

    var subject = '[nagoya-hotel-deals] ' + deal.hotelName + ' ▶ ' + stayDateStr + ' ¥' + deal.charge.toLocaleString();

    var lines = [];
    lines.push('ホテル: ' + deal.hotelName);
    lines.push('宿泊日: ' + formatDate(stayDateObj) + ' (' + dayOfWeek + ')');
    lines.push('プラン: ' + deal.planName);

    if (deal.targetPrice && deal.charge <= deal.targetPrice) {
      var savings = deal.targetPrice - deal.charge;
      lines.push('料金: ¥' + deal.charge.toLocaleString() + '（目標: ¥' + deal.targetPrice.toLocaleString() + ' → ¥' + savings.toLocaleString() + ' お得）');
    } else {
      lines.push('料金: ¥' + deal.charge.toLocaleString() + '（割安率: ' + deal.discountRate + '%）');
    }

    lines.push('評点: ' + deal.reviewAverage + ' (' + deal.reviewCount + '件)');
    lines.push('');

    if (deal.reserveUrl) {
      lines.push('▶ 予約する: ' + deal.reserveUrl);
    }

    GmailApp.sendEmail(notifyEmail, subject, lines.join('\n'));
  }

  Logger.log(deals.length + '件の通知メールを送信しました');
}
