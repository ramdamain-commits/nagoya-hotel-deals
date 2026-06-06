/**
 * 【ワンショット・手動実行用】PriceLog から非土曜（土曜泊以外）の行を物理削除する。
 *
 * 2026-06-04 に価格取得を土曜泊のみへ変更したため、それ以前に蓄積された
 * 平日・他曜日の行を一掃する目的の関数。日次トリガーには登録しないこと。
 *
 * 安全策（実行前に必須）:
 *   Google Drive でスプレッドシートファイル自体を「コピーを作成」でバックアップする
 *   （シート複製ではなくファイルコピー。名前に日付を入れる）。
 *
 * 実装方針:
 *   deleteRow による行ズレ事故を避けるため、土曜行のみを残して一括 setValues で書き直す。
 *   クリア対象は DATA_START_ROW 以降のデータ行のみ（ヘッダ行は保持）。
 */
function cleanupNonSaturdayPriceLog() {
  var sheet = getSheet(SHEET_PRICE_LOG);
  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) {
    Logger.log('cleanupNonSaturdayPriceLog: 削除対象なし（データ行0件）');
    return;
  }

  var numCols = COL_P.RESERVE_URL;
  var data = sheet.getRange(DATA_START_ROW, 1, lastRow - HEADER_ROW, numCols).getValues();

  var satRows = [];
  for (var i = 0; i < data.length; i++) {
    var stayDate = new Date(data[i][COL_P.STAY_DATE - 1]);
    if (stayDate.getDay() === 6) { // 0=日 ... 6=土
      satRows.push(data[i]);
    }
  }

  var originalCount = data.length;
  var keptCount = satRows.length;
  var deletedCount = originalCount - keptCount;

  // データ行のみクリア（ヘッダ行は保持）
  sheet.getRange(DATA_START_ROW, 1, originalCount, numCols).clearContent();

  // 土曜行のみ DATA_START_ROW から再書き込み
  if (keptCount > 0) {
    sheet.getRange(DATA_START_ROW, 1, keptCount, numCols).setValues(satRows);
  }

  Logger.log('cleanupNonSaturdayPriceLog: 元' + originalCount + '行 → 残' + keptCount + '行（削除' + deletedCount + '行）');
}
