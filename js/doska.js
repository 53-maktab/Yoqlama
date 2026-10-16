/* Elektron doska: o'quvchi ismini bosadi, masala yechadi, "keldi" deb belgilanadi. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var content = $('#content'), overlay = $('#overlay'), toastEl = $('#toast');
  var state = { open: false }, lastJson = '', cur = null, busy = false;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  // 100 gacha natural sonlar ustida oddiy qo'shish/ayirish
  function newProblem() {
    var a, b, op, ans;
    if (Math.random() < 0.5) { op = '+'; a = rand(1, 99); b = rand(1, 100 - a); ans = a + b; }
    else { op = '−'; a = rand(2, 100); b = rand(1, a - 1); ans = a - b; }
    return { a: a, b: b, op: op, answer: ans };
  }

  // ---------- soat ----------
  function tick() {
    var d = new Date();
    $('#time').textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    $('#date').textContent = Logic.weekdayName(Logic.ymd(d)) + ', ' + Logic.dmy(Logic.ymd(d));
  }

  // ---------- ekran ----------
  function render() {
    if (!window.API.configured) {
      content.innerHTML = '<div class="closed-box"><div class="big">Sayt hali sozlanmagan</div><p class="muted">js/config.js ichiga Supabase manzili va kaliti yozilishi kerak.</p></div>';
      return;
    }
    if (!state.open) {
      content.innerHTML = '<div class="closed-box"><div class="big">Yo\'qlama hozir yopiq</div>' +
        '<p class="muted">O\'qituvchi darsni boshlagach, bu yerda ismlar chiqadi.</p></div>';
      return;
    }
    var total = state.students.length, done = state.students.filter(function (s) { return s.marked; }).length;
    var html = '';
    if (state.topic) html += '<div class="topic-line"><b>Mavzu:</b> ' + esc(state.topic) + '</div>';
    html += '<div class="counter">Keldi: ' + done + ' / ' + total + '. Ismingizni bosing.</div><div class="names">';
    state.students.forEach(function (s) {
      html += '<button class="name' + (s.marked ? ' done' : '') + '" data-id="' + esc(s.id) + '"' + (s.marked ? ' disabled' : '') + '>' +
        '<span>' + esc(s.name) + '</span>' + (s.marked ? '<span aria-label="belgilangan">✓</span>' : '') + '</button>';
    });
    html += '</div>';
    content.innerHTML = html;
  }

  async function refresh() {
    if (!window.API.configured) { render(); return; }
    try {
      var s = await window.API.doskaState();
      $('#status').textContent = '';
      var j = JSON.stringify(s);
      state = s && s.open ? s : { open: false };
      if (j !== lastJson && !cur) { lastJson = j; render(); }
      else if (j !== lastJson) { lastJson = j; } // masala paytida ekranni o'zgartirmaymiz
    } catch (e) {
      $('#status').textContent = 'Internet bilan aloqa yo\'q, qayta urinilmoqda...';
    }
  }

  // ---------- toast ----------
  var toastTimer;
  function toast(text, bad) {
    toastEl.textContent = text; toastEl.className = 'toast' + (bad ? ' bad' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.className = 'toast hidden'; }, 3200);
  }

  // ---------- masala oynasi ----------
  function openChallenge(id) {
    var st = state.students.find(function (s) { return s.id === id; });
    if (!st || st.marked) return;
    cur = { student: st, p: newProblem(), input: '', tries: 0 };
    drawChallenge();
  }
  function drawChallenge() {
    var p = cur.p;
    var keys = '';
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].forEach(function (k) {
      keys += '<button type="button" data-k="' + k + '"' + (k === 'OK' ? ' class="ok" aria-label="Tasdiqlash"' : '') +
        (k === '⌫' ? ' aria-label="O\'chirish"' : '') + '>' + (k === 'OK' ? '✓' : k) + '</button>';
    });
    overlay.innerHTML = '<div class="modal"><h2>' + esc(cur.student.name) + ', salom!</h2>' +
      '<p class="muted">Kelganingizni tasdiqlash uchun masalani yeching:</p>' +
      '<div class="problem">' + p.a + ' ' + p.op + ' ' + p.b + ' = ?</div>' +
      '<div class="answer" id="ans" aria-live="polite">' + esc(cur.input) + '</div>' +
      '<div class="msg" id="msg"></div><div class="pad">' + keys + '</div>' +
      '<div class="row" style="margin-top:14px;justify-content:center"><button class="btn" id="cancel">Bekor qilish (bu men emasman)</button></div></div>';
    overlay.classList.remove('hidden');
  }
  function closeOverlay() { overlay.classList.add('hidden'); overlay.innerHTML = ''; cur = null; }

  async function submitAnswer() {
    if (!cur || busy || cur.input === '') return;
    var msg = $('#msg');
    if (Number(cur.input) !== cur.p.answer) {
      cur.tries++;
      var a = $('#ans'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake');
      cur.input = '';
      if (cur.tries >= 3) { cur.p = newProblem(); cur.tries = 0; drawChallenge(); $('#msg').textContent = 'Yangi masala. Qayta urinib ko\'ring.'; $('#msg').className = 'msg bad'; }
      else { a.textContent = ''; msg.textContent = 'Noto\'g\'ri. Qayta urinib ko\'ring.'; msg.className = 'msg bad'; }
      return;
    }
    busy = true;
    try {
      var r = await window.API.doskaMark(cur.student.id);
      var name = cur.student.name;
      closeOverlay();
      if (r && r.ok) toast('✓ ' + name + ', yo\'qlamaga belgilandi!');
      else toast((r && r.error) || 'Xatolik', true);
    } catch (e) {
      msg.textContent = 'Aloqa xatosi. Qayta bosing.'; msg.className = 'msg bad';
    } finally { busy = false; lastJson = ''; refresh(); }
  }

  overlay.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) { return; }
    if (t.id === 'cancel' || t.id === 'closeTerms') { closeOverlay(); return; }
    if (!cur) return;
    var k = t.getAttribute('data-k'); if (!k) return;
    if (k === 'OK') { submitAnswer(); return; }
    if (k === '⌫') cur.input = cur.input.slice(0, -1);
    else if (cur.input.length < 3) cur.input += k;
    $('#ans').textContent = cur.input;
    $('#msg').textContent = '';
  });
  document.addEventListener('keydown', function (e) {
    if (!cur) return;
    if (/^[0-9]$/.test(e.key) && cur.input.length < 3) { cur.input += e.key; $('#ans').textContent = cur.input; }
    else if (e.key === 'Backspace') { cur.input = cur.input.slice(0, -1); $('#ans').textContent = cur.input; }
    else if (e.key === 'Enter') submitAnswer();
    else if (e.key === 'Escape') closeOverlay();
  });

  content.addEventListener('click', function (e) {
    var b = e.target.closest('.name'); if (b && !b.disabled) openChallenge(b.getAttribute('data-id'));
  });
  $('#termsBtn').addEventListener('click', function () {
    overlay.innerHTML = '<div class="modal wide">' + window.TERMS_HTML + '<div class="row" style="justify-content:center"><button class="btn primary" id="closeTerms">Yopish</button></div></div>';
    overlay.classList.remove('hidden');
  });

  tick(); setInterval(tick, 20000);
  render(); refresh(); setInterval(refresh, 4000);
})();
