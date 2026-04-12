/**
 * お得通知メールを送信する（1通にまとめてGmailレート制限を回避）
 * @param {Object[]} deals - 通知対象のプラン情報配列
 */
function sendDealNotifications(deals) {
  var notifyEmail = getConfigValue('NOTIFY_EMAIL');
  if (!notifyEmail) return;

  var subject = '[nagoya-hotel-deals] ' + deals.length + '件のお得プランが見つかりました';
  var bodyParts = [];

  for (var i = 0; i < deals.length; i++) {
    var deal = deals[i];
    // deal.stayDate は Date オブジェクトまたは文字列。UTC ズレ回避のため年月日を分解
    var stayDateObj;
    if (deal.stayDate instanceof Date) {
      stayDateObj = deal.stayDate;
    } else {
      var parts = String(deal.stayDate).split('-');
      stayDateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    var dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][stayDateObj.getDay()];

    var lines = [];
    lines.push('--- ' + (i + 1) + '. ' + deal.hotelName + ' ---');
    lines.push('宿泊日: ' + formatDate(stayDateObj) + ' (' + dayOfWeek + ')');
    lines.push('プラン: ' + deal.planName);

    if (deal.targetPrice && deal.charge <= deal.targetPrice) {
      var savings = deal.targetPrice - deal.charge;
      lines.push('料金: ' + deal.charge + '円（目標: ' + deal.targetPrice + '円 / ' + savings + '円 お得）');
    } else {
      lines.push('料金: ' + deal.charge + '円（割安率: ' + deal.discountRate + '%）');
    }

    lines.push('評点: ' + deal.reviewAverage + ' (' + deal.reviewCount + '件)');

    if (deal.reserveUrl) {
      lines.push('予約: ' + deal.reserveUrl);
    }

    bodyParts.push(lines.join('\n'));
  }

  var footer = '\n\n---\nダッシュボード: https://ramdamain-commits.github.io/nagoya-hotel-deals/';
  GmailApp.sendEmail(notifyEmail, subject, bodyParts.join('\n\n') + footer);
  Logger.log(deals.length + '件の通知メールを送信しました');
}
