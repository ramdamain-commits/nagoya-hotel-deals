// GAS Web App の URL（デプロイ後にここを更新する）
var API_URL = '';

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
function renderChart(hotels, priceHistory) {
  var ctx = document.getElementById('price-chart').getContext('2d');
  var colors = ['#1a237e','#c62828','#2e7d32','#ff6f00','#6a1b9a','#00838f','#4e342e','#546e7a'];

  var latestFetchDate = '';
  for (var hn in priceHistory) {
    var entries = priceHistory[hn];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].fetchDate > latestFetchDate) latestFetchDate = entries[i].fetchDate;
    }
  }

  var allDates = {};
  var datasets = [];

  for (var hi = 0; hi < hotels.length; hi++) {
    var h = hotels[hi];
    var hEntries = priceHistory[h.hotelNo] || [];
    var priceMap = {};

    for (var j = 0; j < hEntries.length; j++) {
      var e = hEntries[j];
      if (e.fetchDate !== latestFetchDate) continue;
      allDates[e.stayDate] = true;
      if (!priceMap[e.stayDate] || e.charge < priceMap[e.stayDate]) {
        priceMap[e.stayDate] = e.charge;
      }
    }

    datasets.push({
      label: h.hotelName,
      priceMap: priceMap,
      borderColor: colors[hi % colors.length],
      fill: false,
      tension: 0.3,
      pointRadius: 3,
    });
  }

  var labels = Object.keys(allDates).sort();

  for (var k = 0; k < datasets.length; k++) {
    datasets[k].data = labels.map(function(d) { return datasets[k].priceMap[d] || null; });
    delete datasets[k].priceMap;
  }

  var isMobile = window.innerWidth < 600;

  new Chart(ctx, {
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
