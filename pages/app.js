// ---- テーマ切替 ----
(function initTheme() {
  var saved = localStorage.getItem('theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = saved || (prefersDark ? 'dark' : 'light');
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

  document.addEventListener('DOMContentLoaded', function() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.addEventListener('click', function() {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        btn.textContent = '🌙';
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        btn.textContent = '☀️';
      }
    });
  });
})();

// GAS Web App の URL（デプロイ後にここを更新する）
var API_URL = 'https://script.google.com/macros/s/AKfycbyg9ijFw9TFjW1P3USrpKMutdw8LAP4aUgg92x7XiTa7vcGpbUqWXPTQmJrfsKawZAc0A/exec';

// ---- グローバルデータ ----
var appData = null;

// ---- 初期化 ----
async function init() {
  document.getElementById('updated-at').textContent = '最終更新: 読み込み中...';

  try {
    var url = API_URL || 'mock-data.json';
    var res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    appData = data;

    renderUpdatedAt(data.updated_at);
    renderSummary(data);
    renderSatBestTable(data.hotels, data.price_history);
    renderChart(data.hotels, data.price_history);
    renderHeatmap(data.hotels, data.price_history);
    renderHotelCards(data.hotels, data.price_history);
    setupNavHighlight();
  } catch (err) {
    var errMsg = '<p class="error-message">データの取得に失敗しました: ' + escapeHtml(err.message) + '</p>';
    document.getElementById('hotel-cards').innerHTML = errMsg;
    document.getElementById('sat-best-container').innerHTML = errMsg;
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

// stayDate 文字列が土曜かどうか（JST ローカル日付で判定）
function isSaturday(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay() === 6;
}

// ---- 最終更新 ----
function renderUpdatedAt(updatedAt) {
  var el = document.getElementById('updated-at');
  if (updatedAt) {
    var d = new Date(updatedAt);
    el.textContent = '最終更新: ' + d.toLocaleString('ja-JP');
  }
}

// ---- ダッシュボード要約バナー（土曜基準） ----
function renderSummary(data) {
  var hotels = data.hotels || [];
  var priceHistory = data.price_history || {};

  // 追跡中ホテル数（enabled のみ）
  var enabledCount = hotels.filter(function(h) { return h.enabled; }).length;
  document.getElementById('summary-hotel-count').textContent = enabledCount;

  // 土曜最安（土曜エントリのみから最安を探す）
  var cheapestCharge = null;
  var cheapestName = '---';
  var cheapestDate = '';
  for (var i = 0; i < hotels.length; i++) {
    var h = hotels[i];
    if (!h.enabled) continue;
    var entries = priceHistory[h.hotelNo] || [];
    for (var j = 0; j < entries.length; j++) {
      var e = entries[j];
      if (!isSaturday(e.stayDate)) continue;
      if (cheapestCharge === null || e.charge < cheapestCharge) {
        cheapestCharge = e.charge;
        cheapestName = h.hotelName;
        cheapestDate = e.stayDate;
      }
    }
  }
  if (cheapestCharge !== null) {
    document.getElementById('summary-cheapest-price').textContent = '¥' + cheapestCharge.toLocaleString();
    var cheapestMonth = parseInt(cheapestDate.slice(5, 7), 10);
    var cheapestDay = parseInt(cheapestDate.slice(8, 10), 10);
    document.getElementById('summary-cheapest-name').textContent =
      cheapestName + ' ' + cheapestMonth + '/' + cheapestDay;
  } else {
    document.getElementById('summary-cheapest-price').textContent = '---';
    document.getElementById('summary-cheapest-name').textContent = '取得中...';
  }

  // 次の土曜日を計算
  var today = new Date();
  var daysUntilSat = (6 - today.getDay() + 7) % 7;
  if (daysUntilSat === 0) daysUntilSat = 7; // 今日が土曜なら来週
  var nextSat = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysUntilSat);
  var nextSatStr = formatDateLocal(nextSat);

  // 次の土曜日の最安を探す
  var satCheapestCharge = null;
  var satCheapestName = '---';
  for (var si = 0; si < hotels.length; si++) {
    var sh = hotels[si];
    if (!sh.enabled) continue;
    var sEntries = priceHistory[sh.hotelNo] || [];
    for (var sj = 0; sj < sEntries.length; sj++) {
      var se = sEntries[sj];
      if (se.stayDate !== nextSatStr) continue;
      if (satCheapestCharge === null || se.charge < satCheapestCharge) {
        satCheapestCharge = se.charge;
        satCheapestName = sh.hotelName;
      }
    }
  }
  var satMonth = nextSat.getMonth() + 1;
  var satDay = nextSat.getDate();
  if (satCheapestCharge !== null) {
    document.getElementById('summary-sat-price').textContent = '¥' + satCheapestCharge.toLocaleString();
    document.getElementById('summary-sat-detail').textContent =
      satMonth + '/' + satDay + ' ' + satCheapestName;
  } else {
    document.getElementById('summary-sat-price').textContent = '---';
    document.getElementById('summary-sat-detail').textContent = satMonth + '/' + satDay + ' データなし';
  }
}

// ---- 土曜ベスト早見表 ----
// 各土曜（stayDate）で最も安いホテルと価格を、安い土曜順に並べる
function renderSatBestTable(hotels, priceHistory) {
  var container = document.getElementById('sat-best-container');

  // stayDate -> { charge, hotelName, targetPrice }
  var bestByDate = {};
  for (var hi = 0; hi < hotels.length; hi++) {
    var h = hotels[hi];
    if (!h.enabled) continue;
    var entries = priceHistory[h.hotelNo] || [];

    // このホテルの土曜 stayDate ごとの「最新 fetchDate の最安 charge」
    var hotelBest = {};
    for (var j = 0; j < entries.length; j++) {
      var e = entries[j];
      if (!isSaturday(e.stayDate)) continue;
      if (!e.charge) continue; // 0/null は除外
      var cur = hotelBest[e.stayDate];
      if (!cur || e.fetchDate > cur.fetchDate || (e.fetchDate === cur.fetchDate && e.charge < cur.charge)) {
        hotelBest[e.stayDate] = { charge: e.charge, fetchDate: e.fetchDate };
      }
    }

    // 全ホテル横断の各土曜最安を更新
    for (var sd in hotelBest) {
      var c = hotelBest[sd].charge;
      var b = bestByDate[sd];
      if (!b || c < b.charge) {
        bestByDate[sd] = { charge: c, hotelName: h.hotelName, targetPrice: h.targetPrice };
      }
    }
  }

  var rows = [];
  for (var d in bestByDate) {
    rows.push({
      stayDate: d,
      charge: bestByDate[d].charge,
      hotelName: bestByDate[d].hotelName,
      targetPrice: bestByDate[d].targetPrice,
    });
  }

  if (rows.length === 0) {
    container.innerHTML = '<p class="loading">土曜の価格データがありません。</p>';
    return;
  }

  // 最安値が安い土曜が上
  rows.sort(function(a, b) { return a.charge - b.charge; });

  var html = '<div style="overflow-x:auto;"><table class="sat-best-table">'
    + '<thead><tr><th>土曜</th><th>最安ホテル</th><th>最安値</th><th></th></tr></thead><tbody>';
  for (var k = 0; k < rows.length; k++) {
    var r = rows[k];
    var m = parseInt(r.stayDate.slice(5, 7), 10);
    var day = parseInt(r.stayDate.slice(8, 10), 10);
    var dateLabel = m + '/' + day + ' (土)';
    var onTarget = r.targetPrice && r.charge <= r.targetPrice;
    var badge = onTarget ? '<span class="target-badge">目標達成</span>' : '';
    var rowClass = k === 0 ? ' class="best-row"' : '';
    html += '<tr' + rowClass + '>'
      + '<td>' + escapeHtml(dateLabel) + '</td>'
      + '<td>' + escapeHtml(r.hotelName) + '</td>'
      + '<td>¥' + r.charge.toLocaleString() + '</td>'
      + '<td>' + badge + '</td>'
      + '</tr>';
  }
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

// ---- ヒートマップ（5色グラデーション） ----
function getHeatClass(ratio) {
  if (ratio < 0.2) return 'heat-very-cheap';
  if (ratio < 0.4) return 'heat-cheap';
  if (ratio < 0.6) return 'heat-normal';
  if (ratio < 0.8) return 'heat-expensive';
  return 'heat-very-expensive';
}

function renderHeatmap(hotels, priceHistory) {
  var container = document.getElementById('heatmap-container');

  var allDates = {};
  for (var hn in priceHistory) {
    var entries = priceHistory[hn];
    for (var i = 0; i < entries.length; i++) {
      if (!isSaturday(entries[i].stayDate)) continue;
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
      if (!isSaturday(e.stayDate)) continue;
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
        var heatClass = getHeatClass(ratio);
        html += '<td class="' + heatClass + '">¥' + (cell.charge / 1000).toFixed(1) + 'k</td>';
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;

  // summaryのホテル数×日数を動的更新
  var summaryEl = document.querySelector('#heatmap-details summary');
  if (summaryEl) {
    summaryEl.textContent = '土曜 × ホテル 価格ヒートマップを表示（' + hotels.length + 'ホテル × ' + dates.length + '土曜）';
  }
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

    // 宿泊日の全集合を収集（直近7fetchDate分・土曜のみ）
    for (var ti = 0; ti < targetHotels.length; ti++) {
      var hEntries = priceHistory[targetHotels[ti].hotelNo] || [];
      for (var j = 0; j < hEntries.length; j++) {
        if (!isSaturday(hEntries[j].stayDate)) continue;
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
            title: { display: !isMobile, text: '宿泊日（土曜）' },
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

  // ---- 比較モード ----
  var compareToggle = document.getElementById('compare-toggle');
  var comparePanel = document.getElementById('compare-panel');
  var compareCheckboxes = document.getElementById('compare-checkboxes');
  var compareClear = document.getElementById('compare-clear');
  var isCompareMode = false;
  var MAX_COMPARE = 5;

  // チェックボックスを構築
  for (var ci = 0; ci < hotels.length; ci++) {
    var lbl = document.createElement('label');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = hotels[ci].hotelNo;
    cb.dataset.index = ci;
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(hotels[ci].hotelName));
    compareCheckboxes.appendChild(lbl);
  }

  function getSelectedCompareHotels() {
    var checked = compareCheckboxes.querySelectorAll('input:checked');
    var nos = [];
    for (var i = 0; i < checked.length; i++) nos.push(checked[i].value);
    return nos;
  }

  function drawCompareChart(hotelNos) {
    var allDates = {};
    var targetH = hotels.filter(function(h) {
      return hotelNos.indexOf(h.hotelNo) >= 0;
    });

    // 最新fetchDate を特定
    var latestFetch = allFetchDates[0];

    for (var ti = 0; ti < targetH.length; ti++) {
      var hEntries = priceHistory[targetH[ti].hotelNo] || [];
      for (var j = 0; j < hEntries.length; j++) {
        if (!isSaturday(hEntries[j].stayDate)) continue;
        if (hEntries[j].fetchDate === latestFetch) {
          allDates[hEntries[j].stayDate] = true;
        }
      }
    }
    var labels = Object.keys(allDates).sort();
    var datasets = [];

    for (var hi = 0; hi < targetH.length; hi++) {
      var h = targetH[hi];
      var entries = priceHistory[h.hotelNo] || [];
      var lineData = labels.map(function(sd) {
        var best = null;
        for (var k = 0; k < entries.length; k++) {
          if (entries[k].stayDate === sd && entries[k].fetchDate === latestFetch) {
            if (!best || entries[k].charge < best.charge) best = entries[k];
          }
        }
        return best ? best.charge : null;
      });
      datasets.push({
        label: h.hotelName,
        data: lineData,
        borderColor: colors[hi % colors.length],
        fill: false,
        tension: 0.3,
        pointRadius: 3,
      });
    }

    var ctx = document.getElementById('price-chart').getContext('2d');
    var isMobile = window.innerWidth < 600;
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: !isMobile,
        aspectRatio: isMobile ? 1 : 2,
        scales: {
          x: { title: { display: !isMobile, text: '宿泊日（土曜）' }, ticks: { maxRotation: 45, font: { size: isMobile ? 10 : 12 } } },
          y: { title: { display: !isMobile, text: '料金（円）' }, ticks: { font: { size: isMobile ? 10 : 12 }, callback: function(v) { return '¥' + v.toLocaleString(); } }, beginAtZero: false },
        },
        plugins: { legend: { position: 'bottom', labels: { font: { size: isMobile ? 10 : 12 }, boxWidth: isMobile ? 12 : 40 } } },
      },
    });
  }

  compareToggle.addEventListener('click', function() {
    isCompareMode = !isCompareMode;
    compareToggle.classList.toggle('active', isCompareMode);
    comparePanel.style.display = isCompareMode ? '' : 'none';
    select.style.display = isCompareMode ? 'none' : '';
    if (!isCompareMode) {
      drawChart(select.value);
    } else {
      var sel = getSelectedCompareHotels();
      if (sel.length > 0) drawCompareChart(sel);
    }
  });

  compareCheckboxes.addEventListener('change', function(e) {
    var target = e.target;
    if (target.tagName !== 'INPUT') return;
    var lbl2 = target.parentElement;
    lbl2.classList.toggle('checked', target.checked);

    // 上限チェック
    var sel = getSelectedCompareHotels();
    if (sel.length > MAX_COMPARE && target.checked) {
      target.checked = false;
      lbl2.classList.remove('checked');
      return;
    }
    if (sel.length > 0) drawCompareChart(sel);
  });

  compareClear.addEventListener('click', function() {
    var cbs = compareCheckboxes.querySelectorAll('input');
    for (var i = 0; i < cbs.length; i++) {
      cbs[i].checked = false;
      cbs[i].parentElement.classList.remove('checked');
    }
    drawChart('all');
  });

  // 初回描画（全ホテル中央値）
  drawChart('all');

  // ドロップダウン変更時に再描画
  select.addEventListener('change', function() {
    drawChart(select.value);
  });
}

// ---- ホテル一覧カード ----
// priceHistory を第2引数として受け取り、土曜の最安値・最安日・目標との差を表示
function renderHotelCards(hotels, priceHistory) {
  var container = document.getElementById('hotel-cards');
  container.innerHTML = hotels.filter(function(h) { return h.enabled; }).map(function(h) {
    var targetText = h.targetPrice ? '¥' + h.targetPrice.toLocaleString() : '---';
    var avgText = h.recentAvgPrice ? '¥' + h.recentAvgPrice.toLocaleString() : '未蓄積';

    // 土曜の最安値と最安の宿泊日を計算
    var allLowest = null;
    var allLowestDate = '';
    var hEntries = (priceHistory && priceHistory[h.hotelNo]) || [];
    for (var i = 0; i < hEntries.length; i++) {
      var e = hEntries[i];
      if (!isSaturday(e.stayDate)) continue;
      if (allLowest === null || e.charge < allLowest) {
        allLowest = e.charge;
        allLowestDate = e.stayDate;
      }
    }
    var lowestText = allLowest !== null ? '¥' + allLowest.toLocaleString() : '---';
    var lowestDateText = '';
    if (allLowestDate) {
      var lm = parseInt(allLowestDate.slice(5, 7), 10);
      var ld = parseInt(allLowestDate.slice(8, 10), 10);
      lowestDateText = ' (' + lm + '/' + ld + ')';
    }

    // 目標価格との差（30日平均ベース）
    var diffText = '';
    var cardClass = 'card';
    if (h.targetPrice && h.recentAvgPrice) {
      var diffPct = Math.round((h.recentAvgPrice - h.targetPrice) / h.targetPrice * 100);
      if (diffPct <= 0) {
        // 平均が目標以下: 緑ボーダー
        cardClass = 'card card-on-target';
        diffText = '<div class="meta" style="color:#2e7d32;font-weight:bold;">現在 ' + diffPct + '% (目標以下)</div>';
      } else {
        diffText = '<div class="meta" style="color:#c62828;">現在 +' + diffPct + '% (目標超)</div>';
      }
    }

    return '<div class="' + cardClass + '">'
      + '<h3>' + escapeHtml(h.hotelName) + '</h3>'
      + '<div class="meta">目標: ' + targetText + ' / 30日平均: ' + avgText + '</div>'
      + '<div class="meta">土曜最安: ' + lowestText + lowestDateText + '</div>'
      + diffText
      + '</div>';
  }).join('');
}

// ---- ナビのアクティブセクションハイライト ----
// IntersectionObserver でスクロール位置に応じてナビリンクにアクティブクラスを付与
function setupNavHighlight() {
  var sections = document.querySelectorAll('main > section');
  var navLinks = document.querySelectorAll('.sticky-nav-list a');

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        navLinks.forEach(function(link) { link.classList.remove('active'); });
        var activeLink = document.querySelector('.sticky-nav-list a[href="#' + entry.target.id + '"]');
        if (activeLink) activeLink.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });

  sections.forEach(function(section) { observer.observe(section); });
}

// ---- エスケープ ----
function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

init();
