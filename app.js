'use strict';

/* Hotel HIIT — 「今日 HIIT をやったか」だけを残すアプリ。
   保存先は localStorage ひとつ。日付はすべて端末のローカル日付で扱う。 */

var STORE_KEY = 'hotel-hiit.v1';
var WEEKS = 12;                 // ヒートマップに出す週数
var DOW_LABELS = ['月', '火', '水', '木', '金', '土', '日'];
var SHOW_DOW = [0, 2, 4];       // 月・水・金だけラベルを出す

/* ---------------- 日付ユーティリティ ---------------- */

function pad(n) { return n < 10 ? '0' + n : String(n); }

function dayKey(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function parseKey(k) {
  var p = k.split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function today() {
  var n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

// 月曜始まりの曜日番号（月=0 … 日=6）
function dowMon(d) { return (d.getDay() + 6) % 7; }

function formatLong(d) {
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日（' + DOW_LABELS[dowMon(d)] + '）';
}

function formatShort(d) {
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

/* ---------------- 保存 ---------------- */

var state = load();

function load() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { version: 1, days: {} };
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.days || typeof parsed.days !== 'object') {
      return { version: 1, days: {} };
    }
    return { version: 1, days: parsed.days };
  } catch (e) {
    return { version: 1, days: {} };
  }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('保存できなかった。ストレージを確認して');
  }
}

function isDone(key) {
  return Object.prototype.hasOwnProperty.call(state.days, key);
}

function setDone(key, done) {
  if (done) state.days[key] = new Date().toISOString();
  else delete state.days[key];
  save();
}

/* ---------------- 集計 ---------------- */

// 今日が未実施でも、昨日までの連続は途切れていない扱いにする
function currentStreak(base) {
  var cursor = isDone(dayKey(base)) ? base : addDays(base, -1);
  var n = 0;
  while (isDone(dayKey(cursor))) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

function longestStreak() {
  var keys = Object.keys(state.days).sort();
  var best = 0, run = 0, prev = null;
  for (var i = 0; i < keys.length; i++) {
    var d = parseKey(keys[i]);
    if (prev && dayKey(addDays(prev, 1)) === keys[i]) run++;
    else run = 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

function countLastDays(base, n) {
  var c = 0;
  for (var i = 0; i < n; i++) {
    if (isDone(dayKey(addDays(base, -i)))) c++;
  }
  return c;
}

/* ---------------- DOM ---------------- */

var el = {
  todayLabel: document.getElementById('today-label'),
  todayCard: document.getElementById('today-card'),
  todayState: document.getElementById('today-state'),
  tap: document.getElementById('tap'),
  tapLabel: document.getElementById('tap-label'),
  undo: document.getElementById('undo'),
  streak: document.getElementById('stat-streak'),
  best: document.getElementById('stat-best'),
  last30: document.getElementById('stat-30'),
  hmRange: document.getElementById('hm-range'),
  hmMonths: document.getElementById('hm-months'),
  hmDows: document.getElementById('hm-dows'),
  hmGrid: document.getElementById('hm-grid'),
  toggleTable: document.getElementById('toggle-table'),
  tableWrap: document.getElementById('tablewrap'),
  tableBody: document.getElementById('table-body'),
  tip: document.getElementById('tip'),
  toast: document.getElementById('toast')
};

var toastTimer = null;

function toast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.toast.hidden = true; }, 1900);
}

/* ---------------- 描画 ---------------- */

function render() {
  var base = today();
  var todayDone = isDone(dayKey(base));

  el.todayLabel.textContent = formatLong(base);
  el.todayCard.classList.toggle('is-done', todayDone);
  el.todayState.textContent = todayDone ? '今日はやった' : '今日はまだ';
  el.tapLabel.textContent = todayDone ? '実施済み' : 'HIIT した';
  el.tap.setAttribute('aria-pressed', todayDone ? 'true' : 'false');
  el.undo.hidden = !todayDone;

  el.streak.textContent = String(currentStreak(base));
  el.best.textContent = String(longestStreak());
  el.last30.innerHTML = countLastDays(base, 30) + '<span class="tile__unit">/30</span>';

  renderHeatmap(base);
  renderTable();
}

function renderHeatmap(base) {
  var start = addDays(base, -dowMon(base) - 7 * (WEEKS - 1)); // 12週前の月曜
  var end = addDays(start, WEEKS * 7 - 1);

  el.hmRange.textContent = formatShort(start) + ' 〜 ' + formatShort(end);

  // 曜日ラベル
  el.hmDows.textContent = '';
  for (var r = 0; r < 7; r++) {
    var lab = document.createElement('span');
    lab.textContent = SHOW_DOW.indexOf(r) >= 0 ? DOW_LABELS[r] : '';
    el.hmDows.appendChild(lab);
  }

  // 月ラベル（月が変わった週の列にだけ置く）
  el.hmMonths.textContent = '';
  var prevMonth = -1;
  for (var w = 0; w < WEEKS; w++) {
    var monday = addDays(start, w * 7);
    var span = document.createElement('span');
    if (monday.getMonth() !== prevMonth) {
      span.textContent = (monday.getMonth() + 1) + '月';
      prevMonth = monday.getMonth();
    }
    el.hmMonths.appendChild(span);
  }

  // セル
  var baseKey = dayKey(base);
  var frag = document.createDocumentFragment();
  for (var col = 0; col < WEEKS; col++) {
    for (var row = 0; row < 7; row++) {
      var d = addDays(start, col * 7 + row);
      var key = dayKey(d);
      var future = d > base;
      var done = isDone(key);

      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell' + (done ? ' is-done' : '') + (future ? ' is-future' : '') + (key === baseKey ? ' is-today' : '');
      cell.dataset.key = key;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', formatShort(d) + '（' + DOW_LABELS[row] + '）' + (future ? '・未来' : done ? '・実施' : '・未実施'));
      if (future) {
        cell.disabled = true;
        cell.tabIndex = -1;
      }
      frag.appendChild(cell);
    }
  }
  el.hmGrid.textContent = '';
  el.hmGrid.appendChild(frag);
}

function renderTable() {
  var keys = Object.keys(state.days).sort().reverse();
  var frag = document.createDocumentFragment();
  for (var i = 0; i < keys.length; i++) {
    var d = parseKey(keys[i]);
    var tr = document.createElement('tr');
    var td1 = document.createElement('td');
    var td2 = document.createElement('td');
    td1.textContent = keys[i];
    td2.textContent = DOW_LABELS[dowMon(d)];
    tr.appendChild(td1);
    tr.appendChild(td2);
    frag.appendChild(tr);
  }
  if (keys.length === 0) {
    var tr0 = document.createElement('tr');
    var td0 = document.createElement('td');
    td0.colSpan = 2;
    td0.textContent = 'まだ記録がない';
    tr0.appendChild(td0);
    frag.appendChild(tr0);
  }
  el.tableBody.textContent = '';
  el.tableBody.appendChild(frag);
}

/* ---------------- 操作 ---------------- */

function toggleDay(key, label) {
  var next = !isDone(key);
  setDone(key, next);
  render();
  toast(label + (next ? 'を記録した' : 'の記録を消した'));
}

el.tap.addEventListener('click', function () {
  var base = today();
  toggleDay(dayKey(base), '今日');
});

el.undo.addEventListener('click', function () {
  var base = today();
  setDone(dayKey(base), false);
  render();
  toast('今日の記録を消した');
});

el.hmGrid.addEventListener('click', function (ev) {
  var cell = ev.target.closest('.cell');
  if (!cell || cell.disabled) return;
  toggleDay(cell.dataset.key, formatShort(parseKey(cell.dataset.key)));
});

/* セルのホバーツールチップ（ポインタのある環境だけ） */
if (window.matchMedia('(hover: hover)').matches) {
  el.hmGrid.addEventListener('mouseover', function (ev) {
    var cell = ev.target.closest('.cell');
    if (!cell) return;
    var d = parseKey(cell.dataset.key);
    var stateText = cell.classList.contains('is-future') ? 'まだ先'
      : cell.classList.contains('is-done') ? '実施' : '未実施';
    el.tip.textContent = formatShort(d) + '（' + DOW_LABELS[dowMon(d)] + '） ' + stateText;
    el.tip.hidden = false;
    var r = cell.getBoundingClientRect();
    el.tip.style.left = (r.left + r.width / 2) + 'px';
    el.tip.style.top = (r.top - 6) + 'px';
  });
  el.hmGrid.addEventListener('mouseleave', function () { el.tip.hidden = true; });
}

el.toggleTable.addEventListener('click', function () {
  var open = el.tableWrap.hidden;
  el.tableWrap.hidden = !open;
  el.toggleTable.setAttribute('aria-expanded', open ? 'true' : 'false');
  el.toggleTable.textContent = open ? '一覧を閉じる' : '実施日を一覧で見る';
});

/* ---------------- 書き出し・読み込み ---------------- */

document.getElementById('export').addEventListener('click', function () {
  var payload = { version: 1, exportedAt: new Date().toISOString(), days: state.days };
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'hotel-hiit-' + dayKey(today()) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
});

document.getElementById('import-open').addEventListener('click', function () {
  document.getElementById('import').click();
});

document.getElementById('import').addEventListener('change', function (ev) {
  var file = ev.target.files && ev.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var parsed = JSON.parse(String(reader.result));
      if (!parsed || !parsed.days || typeof parsed.days !== 'object') throw new Error('形式が違う');
      var added = 0;
      var keys = Object.keys(parsed.days);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
        if (isDone(k)) continue;
        var v = parsed.days[k];
        state.days[k] = typeof v === 'string' ? v : new Date().toISOString();
        added++;
      }
      save();
      render();
      toast(added + ' 日を取り込んだ');
    } catch (e) {
      toast('読み込めなかった。JSON の形式を確認して');
    }
    ev.target.value = '';
  };
  reader.readAsText(file);
});

document.getElementById('reset').addEventListener('click', function () {
  var n = Object.keys(state.days).length;
  if (n === 0) { toast('消すものがない'); return; }
  if (!window.confirm(n + ' 日ぶんの記録を全部消す。戻せない。いい？')) return;
  state = { version: 1, days: {} };
  save();
  render();
  toast('全部消した');
});

/* ---------------- 日付が変わったら描き直す ---------------- */

var lastSeenKey = dayKey(today());

function checkDateRollover() {
  var k = dayKey(today());
  if (k !== lastSeenKey) {
    lastSeenKey = k;
    render();
  }
}

setInterval(checkDateRollover, 30000);
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) { checkDateRollover(); render(); }
});

/* ---------------- 起動 ---------------- */

render();

/* オフライン起動できるかを画面に出しておく。
   機内や電波の悪いホテルで開く前に、ここで確かめられるように。 */
function showOfflineState(text) {
  var node = document.getElementById('offline-state');
  if (node) node.textContent = 'オフライン起動: ' + text;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function () {
      showOfflineState('有効');
    }).catch(function (err) {
      console.warn('Service Worker を登録できなかった:', err);
      showOfflineState('無効（' + (err && err.message ? err.message : '登録に失敗') + '）');
    });
  });
} else {
  showOfflineState('このブラウザでは使えない');
}
