// GAS Web App の URL（デプロイ後にここを更新する）
var API_URL = 'https://script.google.com/macros/s/AKfycbyg9ijFw9TFjW1P3USrpKMutdw8LAP4aUgg92x7XiTa7vcGpbUqWXPTQmJrfsKawZAc0A/exec';

// ---- グローバルデータ ----
var appData = null;

// ---- 初期化 ----
async function init() {
  document.getElementById('recommend-results').innerHTML = '';
  document.getElementById('updated-at').textContent = '最終更新: 読み込み中...';

  // 日付ピッカーの初期値を明日に設定
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('stay-date').value = formatDateLocal(tomorrow);

  // 検索ボタン
  document.getElementById('search-btn').addEventListener('click', onSearchClick);

  try {
    var url = API_URL || 'mock-data.json';
    var res = await fetch(url);
    var data = await res.json();
    appData = data;

    renderUpdatedAt(data.updated_at);
    renderHotelCards(data.hotels);
    renderDealCards(data.hotels, data.price_history);
    renderHeatmap(data.hotels, data.price_history);
    renderChart(data.hotels, data.price_history);
    renderNotifyHistory(data.notify_history);
    renderWeekdayHeatmap(data.hotels, data.price_history);
  } catch (err) {
    document.getElementById('hotel-cards').innerHTML =
      '<p style="color:red;">データの取得に失敗しました: ' + err.message + '</p>';
  }
}

// ---- 日付フォーマット ----
function formatDateLocal(d) {
  var y = d.getFullYear();
  var m = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return y + '-' + m + '-' + day;
}

function getDayOfWeek(dateStr) {
  var d = new Date(dateStr + 'T00:00:00');
  return ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
}

// ---- 最終更新 ----
function renderUpdatedAt(updatedAt) {
  var el = document.getElementById('updated-at');
  if (updatedAt) {
    var d = new Date(updatedAt);
    el.textContent = '最終更新: ' + d.toLocaleString('ja-JP');
  }
}

// ---- デート日おすすめ検索 ----
function onSearchClick() {
  if (!appData) return;
  var dateStr = document.getElementById('stay-date').value;
  if (!dateStr) return;
  renderRecommendResults(dateStr, appData.hotels, appData.price_history);
}

function renderRecommendResults(dateStr, hotels, priceHistory) {
  var container = document.getElementById('recommend-results');
  var results = [];

  for (var i = 0; i < hotels.length; i++) {
    var h = hotels[i];
    if (!h.enabled) continue;

    var entries = priceHistory[h.hotelNo] || [];
    var best = null;
    for (var j = 0; j < entries.length; j++) {
      var e = entries[j];
      if (e.stayDate !== dateStr) continue;
      if (!best || e.fetchDate > best.fetchDate || (e.fetchDate === best.fetchDate && e.charge < best.charge)) {
        best = e;
      }
    }
    if (!best) continue;

    var discountRate = best.discountRate || 0;
    var clampedDiscount = Math.max(0, discountRate);
    var reviewAvg = best.reviewAverage || 0;
    var score = Math.round(reviewAvg * clampedDiscount * 10) / 10;

    results.push({
      hotelNo: h.hotelNo,
      hotelName: h.hotelName,
      targetPrice: h.targetPrice,
      charge: best.charge,
      planName: best.planName,
      discountRate: discountRate,
      reviewAverage: reviewAvg,
      score: score,
      reserveUrl: best.reserveUrl,
    });
  }

  if (results.length === 0) {
    container.innerHTML = '<p class="loading">この日は空室が見つかりませんでした。</p>';
    return;
  }

  results.sort(function(a, b) { return b.score - a.score; });

  var dayLabel = dateStr + ' (' + getDayOfWeek(dateStr) + ')';
  var html = '<h3>' + escapeHtml(dayLabel) + ' のおすすめ</h3><div class="card-grid">';

  for (var k = 0; k < results.length; k++) {
    var r = results[k];
    var badgeClass = r.score >= 80 ? 'badge-high' : (r.score >= 30 ? 'badge-mid' : 'badge-low');
    var discountClass = r.discountRate >= 0 ? 'discount-positive' : 'discount-negative';
    var discountLabel = (r.discountRate >= 0 ? '+' : '') + r.discountRate.toFixed(1) + '%';
    var reserveLink = r.reserveUrl
      ? '<a class="btn-reserve" href="' + escapeHtml(r.reserveUrl) + '" target="_blank" rel="noopener">予約する</a>'
      : '';

    html += '<div class="card">'
      + '<span class="badge-score ' + badgeClass + '">スコア ' + r.score + '</span>'
      + '<h3>' + escapeHtml(r.hotelName) + '</h3>'
      + '<div class="price">¥' + r.charge.toLocaleString() + '</div>'
      + '<div class="meta">'
      + '割安率: <span class="' + discountClass + '">' + discountLabel + '</span>'
      + ' / 評点: ' + r.reviewAverage
      + '</div>'
      + '<div class="meta">プラン: ' + escapeHtml(r.planName) + '</div>'
      + reserveLink
      + '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

// ---- お得アラート ----
function renderDealCards(hotels, priceHistory) {
  var container = document.getElementById('deal-cards');
  var noDealEl = document.getElementById('no-deals');
  var deals = [];

  for (var i = 0; i < hotels.length; i++) {
    var h = hotels[i];
    var entries = priceHistory[h.hotelNo] || [];
    for (var j = 0; j < entries.length; j++) {
      var e = entries[j];
      if (h.targetPrice && e.charge <= h.targetPrice) {
        deals.push({ hotelName: h.hotelName, stayDate: e.stayDate, charge: e.charge,
          targetPrice: h.targetPrice, planName: e.planName, reserveUrl: e.reserveUrl });
      }
    }
  }

  if (deals.length === 0) {
    container.innerHTML = '';
    noDealEl.hidden = false;
    return;
  }
  noDealEl.hidden = true;

  deals.sort(function(a, b) { return a.charge - b.charge; });
  deals = deals.slice(0, 6);

  container.innerHTML = deals.map(function(d) {
    var savings = d.targetPrice - d.charge;
    var dayLabel = d.stayDate + ' (' + getDayOfWeek(d.stayDate) + ')';
    var reserveLink = d.reserveUrl
      ? '<a class="btn-reserve" href="' + escapeHtml(d.reserveUrl) + '" target="_blank" rel="noopener">予約する</a>'
      : '';
    return '<div class="card">'
      + '<h3>' + escapeHtml(d.hotelName) + '</h3>'
      + '<div class="meta">' + escapeHtml(dayLabel) + '</div>'
      + '<div class="price">¥' + d.charge.toLocaleString() + '</div>'
      + '<div class="meta">目標¥' + d.targetPrice.toLocaleString() + ' → ¥' + savings.toLocaleString() + ' お得</div>'
      + '<div class="meta">' + escapeHtml(d.planName) + '</div>'
      + reserveLink
      + '</div>';
  }).join('');
}

// ---- ヒートマップ ----
function renderHeatmap(hotels, priceHistory) {
  var container = document.getElementById('heatmap-container');

  var allDates = {};
  for (var hn in priceHistory) {
    var entries = priceHistory[hn];
    for (var i = 0; i < entries.length; i++) {
      allDates[entries[i].stayDate] = true;
    }
  }
  var dates = Object.keys(allDates).sort();
  if (dates.length === 0) { container.innerHTML = '<p class="loading">データなし</p>'; return; }

  var matrix = {};
  for (var h = 0; h < hotels.length; h++) {
    var hotelNo = hotels[h].hotelNo;
    matrix[hotelNo] = {};
    var hEntries = priceHistory[hotelNo] || [];
    for (var j = 0; j < hEntries.length; j++) {
      var e = hEntries[j];
      var cur = matrix[hotelNo][e.stayDate];
      if (!cur || e.fetchDate > cur.fetchDate || (e.fetchDate === cur.fetchDate && e.charge < cur.charge)) {
        matrix[hotelNo][e.stayDate] = { charge: e.charge, fetchDate: e.fetchDate };
      }
    }
  }

  var allCharges = [];
  for (var hn2 in matrix) {
    for (var d in matrix[hn2]) { allCharges.push(matrix[hn2][d].charge); }
  }
  var minCharge = Math.min.apply(null, allCharges);
  var maxCharge = Math.max.apply(null, allCharges);
  var range = maxCharge - minCharge || 1;

  var html = '<table class="heatmap-table"><thead><tr><th></th>';
  for (var di = 0; di < dates.length; di++) {
    var ds = dates[di].slice(5);
    html += '<th>' + ds + '<br>' + getDayOfWeek(dates[di]) + '</th>';
  }
  html += '</tr></thead><tbody>';

  for (var hi = 0; hi < hotels.length; hi++) {
    var ht = hotels[hi];
    html += '<tr><th>' + escapeHtml(ht.hotelName) + '</th>';
    for (var dj = 0; dj < dates.length; dj++) {
      var cell = matrix[ht.hotelNo] ? matrix[ht.hotelNo][dates[dj]] : null;
      if (!cell) {
        html += '<td class="heat-nodata">満室</td>';
      } else {
        var ratio = (cell.charge - minCharge) / range;
        var heatClass = ratio < 0.33 ? 'heat-cheap' : (ratio < 0.66 ? 'heat-normal' : 'heat-expensive');
        html += '<td class="' + heatClass + '">¥' + (cell.charge / 1000).toFixed(1) + 'k</td>';
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ---- 価格推移チャート ----
// chartInstance: 再描画時に前のインスタンスを破棄するためのグローバル参照
var chartInstance = null;

function renderChart(hotels, priceHistory) {
  var colors = ['#1a237e','#c62828','#2e7d32','#ff6f00','#6a1b9a','#00838f','#4e342e','#546e7a'];

  // 直近7日分のfetchDateを収集（降順ソート後に最大7件）
  var fetchDateSet = {};
  for (var hn in priceHistory) {
    var entries = priceHistory[hn];
    for (var i = 0; i < entries.length; i++) {
      fetchDateSet[entries[i].fetchDate] = true;
    }
  }
  var allFetchDates = Object.keys(fetchDateSet).sort().reverse().slice(0, 7);

  // ホテル選択ドロップダウンを構築
  var select = document.getElementById('chart-hotel-select');
  // 既存オプション（全ホテル）以外を一度クリア
  while (select.options.length > 1) { select.remove(1); }
  for (var hi2 = 0; hi2 < hotels.length; hi2++) {
    var opt = document.createElement('option');
    opt.value = hotels[hi2].hotelNo;
    opt.textContent = hotels[hi2].hotelName;
    select.appendChild(opt);
  }

  // チャート描画関数（選択ホテルに応じて再描画）
  function drawChart(selectedHotelNo) {
    var allDates = {};

    // 対象ホテルを決定
    var targetHotels = selectedHotelNo === 'all' ? hotels : hotels.filter(function(h) {
      return h.hotelNo === selectedHotelNo;
    });

    // 宿泊日の全集合を収集（直近7fetchDate分）
    for (var ti = 0; ti < targetHotels.length; ti++) {
      var hEntries = priceHistory[targetHotels[ti].hotelNo] || [];
      for (var j = 0; j < hEntries.length; j++) {
        if (allFetchDates.indexOf(hEntries[j].fetchDate) >= 0) {
          allDates[hEntries[j].stayDate] = true;
        }
      }
    }
    var labels = Object.keys(allDates).sort();

    var datasets = [];

    if (selectedHotelNo === 'all') {
      // 全ホテルの中央値ライン（1本）
      var medianData = labels.map(function(stayDate) {
        var charges = [];
        for (var hi3 = 0; hi3 < hotels.length; hi3++) {
          var hEntries2 = priceHistory[hotels[hi3].hotelNo] || [];
          // 直近fetchDateの中で最新のみ使用
          var best = null;
          for (var j2 = 0; j2 < hEntries2.length; j2++) {
            var e2 = hEntries2[j2];
            if (e2.stayDate !== stayDate) continue;
            if (allFetchDates.indexOf(e2.fetchDate) < 0) continue;
            if (!best || e2.fetchDate > best.fetchDate || (e2.fetchDate === best.fetchDate && e2.charge < best.charge)) {
              best = e2;
            }
          }
          if (best) charges.push(best.charge);
        }
        if (charges.length === 0) return null;
        charges.sort(function(a, b) { return a - b; });
        var mid = Math.floor(charges.length / 2);
        return charges.length % 2 === 0 ? (charges[mid - 1] + charges[mid]) / 2 : charges[mid];
      });
      datasets.push({
        label: '全ホテル中央値',
        data: medianData,
        borderColor: '#888888',
        borderWidth: 2,
        borderDash: [5, 3],
        fill: false,
        tension: 0.3,
        pointRadius: 3,
      });
    } else {
      // 選択ホテルの個別ライン（fetchDateごとに1本ずつ）
      for (var fd = 0; fd < allFetchDates.length; fd++) {
        var fetchDate = allFetchDates[fd];
        var hEntries3 = priceHistory[selectedHotelNo] || [];
        var lineData = labels.map(function(stayDate) {
          var best2 = null;
          for (var j3 = 0; j3 < hEntries3.length; j3++) {
            var e3 = hEntries3[j3];
            if (e3.stayDate !== stayDate || e3.fetchDate !== fetchDate) continue;
            if (!best2 || e3.charge < best2.charge) best2 = e3;
          }
          return best2 ? best2.charge : null;
        });
        // データが1件もなければスキップ
        var hasData = lineData.some(function(v) { return v !== null; });
        if (!hasData) continue;
        datasets.push({
          label: '取得: ' + fetchDate,
          data: lineData,
          borderColor: colors[fd % colors.length],
          fill: false,
          tension: 0.3,
          pointRadius: 3,
        });
      }
    }

    var ctx = document.getElementById('price-chart').getContext('2d');
    var isMobile = window.innerWidth < 600;

    // 既存チャートを破棄してから再生成
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: !isMobile,
        aspectRatio: isMobile ? 1 : 2,
        scales: {
          x: {
            title: { display: !isMobile, text: '宿泊日' },
            ticks: { maxRotation: 45, font: { size: isMobile ? 10 : 12 } },
          },
          y: {
            title: { display: !isMobile, text: '料金（円）' },
            ticks: {
              font: { size: isMobile ? 10 : 12 },
              callback: function(v) { return '¥' + v.toLocaleString(); },
            },
            beginAtZero: false,
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: isMobile ? 10 : 12 }, boxWidth: isMobile ? 12 : 40 },
          },
        },
      },
    });
  }

  // 初回描画（全ホテル中央値）
  drawChart('all');

  // ドロップダウン変更時に再描画
  select.onchange = function() {
    drawChart(select.value);
  };
}

// ---- 通知履歴（直近30日）----
function renderNotifyHistory(notifyHistory) {
  var container = document.getElementById('notify-history-container');
  // データがない場合またはフィールド未定義の場合
  if (!notifyHistory || notifyHistory.length === 0) {
    container.innerHTML = '<p class="loading">通知履歴はありません。</p>';
    return;
  }

  var html = '<div style="overflow-x:auto;">'
    + '<table class="notify-table">'
    + '<thead><tr><th>通知日時</th><th>ホテル名</th><th>宿泊日</th></tr></thead>'
    + '<tbody>';

  for (var i = 0; i < notifyHistory.length; i++) {
    var n = notifyHistory[i];
    // notifiedAt は ISO文字列想定
    var notifiedLabel = n.notifiedAt ? new Date(n.notifiedAt).toLocaleString('ja-JP') : '-';
    var stayLabel = n.stayDate ? n.stayDate + ' (' + getDayOfWeek(n.stayDate) + ')' : '-';
    var rowClass = i % 2 === 0 ? '' : ' class="odd"';
    html += '<tr' + rowClass + '>'
      + '<td>' + escapeHtml(notifiedLabel) + '</td>'
      + '<td>' + escapeHtml(n.hotelName || '') + '</td>'
      + '<td>' + escapeHtml(stayLabel) + '</td>'
      + '</tr>';
  }

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

// ---- 曜日別 平均価格ヒートマップ ----
function renderWeekdayHeatmap(hotels, priceHistory) {
  var container = document.getElementById('weekday-heatmap-container');
  var weekdays = ['月', '火', '水', '木', '金', '土', '日'];
  // getDayOfWeek は 日月火水木金土 の順。曜日インデックスは getDay() と対応
  // 列は月〜日の順（月=1, ..., 日=0）に並べる
  var dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Date.getDay() 値の順

  // 直近14日の宿泊日のみを対象にする
  var now = new Date();
  var cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
  var cutoffStr = formatDateLocal(cutoff);

  // ホテル×曜日ごとの合計・件数を集計
  // matrix[hotelNo][dayIndex] = {sum, count}
  var matrix = {};
  for (var hi = 0; hi < hotels.length; hi++) {
    var hotelNo = hotels[hi].hotelNo;
    matrix[hotelNo] = {};
    for (var d = 0; d < 7; d++) { matrix[hotelNo][d] = { sum: 0, count: 0 }; }

    var hEntries = priceHistory[hotelNo] || [];
    // 宿泊日ごとに最新fetchDateの最安値を取得してから集計
    var bestByDate = {};
    for (var j = 0; j < hEntries.length; j++) {
      var e = hEntries[j];
      if (e.stayDate < cutoffStr) continue;
      var cur = bestByDate[e.stayDate];
      if (!cur || e.fetchDate > cur.fetchDate || (e.fetchDate === cur.fetchDate && e.charge < cur.charge)) {
        bestByDate[e.stayDate] = e;
      }
    }
    for (var stayDate in bestByDate) {
      var dayOfWeek = new Date(stayDate + 'T00:00:00').getDay(); // 0=日, 1=月, ...
      matrix[hotelNo][dayOfWeek].sum += bestByDate[stayDate].charge;
      matrix[hotelNo][dayOfWeek].count += 1;
    }
  }

  // 全セルの平均価格を集めてmin/maxを算出
  var allAvgs = [];
  for (var hn in matrix) {
    for (var d2 = 0; d2 < 7; d2++) {
      var cell = matrix[hn][d2];
      if (cell.count > 0) allAvgs.push(cell.sum / cell.count);
    }
  }
  if (allAvgs.length === 0) {
    container.innerHTML = '<p class="loading">データなし</p>';
    return;
  }
  var minAvg = Math.min.apply(null, allAvgs);
  var maxAvg = Math.max.apply(null, allAvgs);
  var range = maxAvg - minAvg || 1;

  // テーブル描画
  var html = '<table class="heatmap-table"><thead><tr><th></th>';
  for (var wi = 0; wi < weekdays.length; wi++) {
    html += '<th>' + weekdays[wi] + '</th>';
  }
  html += '</tr></thead><tbody>';

  for (var hi2 = 0; hi2 < hotels.length; hi2++) {
    var ht = hotels[hi2];
    html += '<tr><th>' + escapeHtml(ht.hotelName) + '</th>';
    for (var wi2 = 0; wi2 < dayOrder.length; wi2++) {
      var dow = dayOrder[wi2];
      var cellData = matrix[ht.hotelNo][dow];
      if (!cellData || cellData.count === 0) {
        html += '<td class="heat-nodata">-</td>';
      } else {
        var avg = cellData.sum / cellData.count;
        var ratio = (avg - minAvg) / range;
        var heatClass = ratio < 0.33 ? 'heat-cheap' : (ratio < 0.66 ? 'heat-normal' : 'heat-expensive');
        html += '<td class="' + heatClass + '">¥' + (avg / 1000).toFixed(1) + 'k</td>';
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = '<div style="overflow-x:auto;">' + html + '</div>';
}

// ---- ホテル一覧カード ----
function renderHotelCards(hotels) {
  var container = document.getElementById('hotel-cards');
  container.innerHTML = hotels.filter(function(h) { return h.enabled; }).map(function(h) {
    var targetText = h.targetPrice ? '¥' + h.targetPrice.toLocaleString() : '---';
    var avgText = h.recentAvgPrice ? '¥' + h.recentAvgPrice.toLocaleString() : '未蓄積';
    return '<div class="card">'
      + '<h3>' + escapeHtml(h.hotelName) + '</h3>'
      + '<div class="meta">目標: ' + targetText + ' / 30日平均: ' + avgText + '</div>'
      + '</div>';
  }).join('');
}

// ---- エスケープ ----
function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

init();
