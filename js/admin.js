/* O'qituvchi paneli */
(function () {
  'use strict';
  var L = window.Logic, API = window.API;
  var root = document.getElementById('root');
  var data = null, tab = 'dars', selDate = L.todayStr(), selMonth = L.monthOf(L.todayStr());
  var TABS = [['dars', 'Dars'], ['darslar', 'Darslar'], ['oquvchilar', 'O\'quvchilar'], ['jarima', 'Jarimalar'],
    ['oy', 'Oy hisobi'], ['tatil', 'Ta\'tillar'], ['shartlar', 'Shartlar']];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function today() { return L.todayStr(); }
  function fmt(n) { return L.sum(n); }
  function lessonOn(d) { return data.lessons.find(function (l) { return l.lesson_date === d; }); }
  function attOf(lid, sid) { return data.attendance.find(function (a) { return a.lesson_id === lid && a.student_id === sid; }); }
  function payOf(lid, sid) { return data.payments.find(function (p) { return p.lesson_id === lid && p.student_id === sid; }); }
  function stu(id) { return data.students.find(function (s) { return s.id === id; }); }
  function $(s) { return document.querySelector(s); }

  // ---------- kirish ----------
  function showSetup() {
    root.innerHTML = '<div class="login"><div class="card"><h1>Sozlash kerak</h1>' +
      '<p>js/config.js ichiga Supabase manzili (URL) va anon kalitini yozing, so\'ng sahifani yangilang.</p></div></div>';
  }
  function showLogin(err) {
    root.innerHTML = '<div class="login"><div class="card"><h1>O\'qituvchi paneli</h1>' +
      '<form id="loginForm"><label for="lg">Login</label><input id="lg" type="text" autocomplete="username" autocapitalize="off" required>' +
      '<label for="pw">Parol</label><input id="pw" type="password" autocomplete="current-password" required>' +
      '<div class="err" id="lerr" role="alert">' + esc(err || '') + '</div>' +
      '<button class="btn primary" style="width:100%;margin-top:8px">Kirish</button></form></div></div>';
    $('#loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      try { await API.login($('#lg').value, $('#pw').value); await load(); }
      catch (x) { $('#lerr').textContent = x.message; }
    });
  }

  async function load() {
    data = await API.loadAll();
    render();
  }

  // ---------- umumiy ko'rinish ----------
  function banners() {
    var h = '', t = today(), c = L.cfg(data);
    L.monthReminders(data, t).forEach(function (r) {
      h += '<div class="banner warn"><span>' + (r.type === 'today'
        ? 'Bugun ' + esc(L.monthName(r.month)) + ' oyining oxirgi darsi. Oy hisobini qilish vaqti.'
        : esc(L.monthName(r.month)) + ' oyining hisobi hali yopilmagan.') +
        '</span><button class="btn small" data-act="goMonth" data-m="' + r.month + '">Oy hisobiga o\'tish</button></div>';
    });
    var pend = L.pendingDates(data, t).filter(function (d) { return d < t; });
    if (pend.length) h += '<div class="banner bad"><span>Belgilanmagan darslar: ' + pend.map(L.dm).join(', ') +
      '. Har biri uchun "o\'tildi" yoki "o\'tilmadi" ni belgilang.</span><button class="btn small" data-act="goTab" data-t="darslar">Darslar</button></div>';
    data.lessons.filter(function (l) { return l.status === 'open' && l.lesson_date < t; }).forEach(function (l) {
      h += '<div class="banner bad"><span>' + L.dm(l.lesson_date) + ' dagi dars hali ochiq. Uni yakunlang.</span>' +
        '<button class="btn small" data-act="openDate" data-d="' + l.lesson_date + '">Ochish</button></div>';
    });
    var pu = L.purgeDue(data, t);
    if (pu.length) h += '<div class="banner info"><span>' + pu.length + ' ta chiqarilgan o\'quvchining ma\'lumotlari ' + c.purge +
      ' kundan beri saqlanmoqda. O\'chirilsinmi?</span><button class="btn small" data-act="goTab" data-t="oquvchilar">Ko\'rish</button></div>';
    return h;
  }

  function render() {
    var h = '<div class="wrap"><div class="top"><h1>Informatika to\'garagi: o\'qituvchi paneli</h1>' +
      '<button class="btn small" data-act="logout">Chiqish</button></div>' + banners() +
      '<div class="tabs" role="tablist">';
    TABS.forEach(function (t) {
      h += '<button class="tab" role="tab" aria-selected="' + (tab === t[0]) + '" data-act="goTab" data-t="' + t[0] + '">' + t[1] + '</button>';
    });
    h += '</div><div id="body">' + ({ dars: tabDars, darslar: tabDarslar, oquvchilar: tabStudents, jarima: tabFines, oy: tabMonth, tatil: tabHolidays, shartlar: tabTerms }[tab])() + '</div></div>';
    root.innerHTML = h;
  }

  function statusBadge(l, hol) {
    if (hol) return '<span class="badge b-info">Bayram/ta\'til</span>';
    if (!l) return '<span class="badge b-warn">Belgilanmagan</span>';
    return { open: '<span class="badge b-warn">Yo\'qlama ochiq</span>', held: '<span class="badge b-ok">O\'tildi</span>', not_held: '<span class="badge b-bad">O\'tilmadi</span>' }[l.status];
  }

  // ---------- Dars ----------
  function tabDars() {
    var d = selDate, l = lessonOn(d), hol = L.holidayOn(d, data.holidays), c = L.cfg(data);
    var h = '<div class="card"><div class="row"><label for="datePick"><b>Sana:</b></label>' +
      '<input type="date" id="datePick" value="' + d + '" data-change="pickDate">' +
      '<button class="btn small" data-act="goToday">Bugun</button>' +
      '<span class="muted">' + L.weekdayName(d) + '</span>' + statusBadge(l, hol) + '</div>';
    if (hol) h += '<div class="banner info">Bu kun bayram/ta\'til (' + esc(hol.reason || '') + '). Bu kundagi dars hisobga olinmaydi.</div>';
    else if (d < c.start) h += '<div class="banner info">Bu sana to\'garak boshlanishidan oldin (' + L.dmy(c.start) + ').</div>';
    else if (L.SCHEDULE_DAYS.indexOf(L.parse(d).getDay()) < 0) h += '<div class="banner info">Bu kun dars jadvalida yo\'q (dushanba, payshanba, juma).</div>';

    h += '<div class="row"><label for="topic"><b>Mavzu:</b></label><input type="text" id="topic" class="grow" placeholder="Bugungi dars mavzusi" value="' + esc(l ? l.topic : '') + '">';
    if (l) h += '<button class="btn small" data-act="saveTopic">Mavzuni saqlash</button>';
    h += '</div><div class="row">';
    if (!l) {
      h += '<button class="btn primary" data-act="openLesson"' + (hol ? ' disabled' : '') + '>Yo\'qlamani ochish (doskaga)</button>' +
        '<button class="btn danger" data-act="notHeld"' + (hol ? ' disabled' : '') + '>Dars o\'tilmadi</button>';
    } else if (l.status === 'open') {
      h += '<button class="btn primary" data-act="finish">Darsni yakunlash (o\'tildi)</button><button class="btn danger" data-act="notHeld">Dars o\'tilmadi</button>';
    } else if (l.status === 'held') {
      h += '<button class="btn" data-act="reopen">Yo\'qlamani qayta ochish</button><button class="btn danger" data-act="notHeld">Dars o\'tilmadi deb o\'zgartirish</button>';
    } else {
      h += '<button class="btn primary" data-act="reopen">Dars o\'tildi (yo\'qlamani ochish)</button>';
    }
    h += '</div></div>';

    if (l && l.status !== 'not_held') {
      var studs = data.students.filter(function (s) { return L.eligible(s, d); })
        .sort(function (a, b) { return a.full_name.localeCompare(b.full_name); });
      var np = 0, ne = 0, na = 0;
      var rows = '';
      studs.forEach(function (s) {
        var a = attOf(l.id, s.id), v = a ? a.status : 'absent';
        if (v === 'present') np++; else if (v === 'excused') ne++; else na++;
        var fine = '';
        if (l.status === 'held' && v === 'absent') {
          fine = payOf(l.id, s.id) ? '<span class="badge b-ok">' + fmt(c.fine) + ' to\'langan</span>' : '<span class="badge b-bad">jarima ' + fmt(c.fine) + '</span>';
        }
        var opts = '<option value="">&mdash;</option>';
        for (var g = 1; g <= 10; g++) opts += '<option value="' + g + '"' + (a && a.grade === g ? ' selected' : '') + '>' + g + '</option>';
        rows += '<tr><td>' + esc(s.full_name) + (s.status === 'removed' ? ' <span class="badge b-warn">chiqarilgan</span>' : '') + '</td><td><div class="seg" role="group" aria-label="' + esc(s.full_name) + ' davomati">' +
          ['present:Keldi', 'excused:Sababli', 'absent:Kelmadi'].map(function (x) {
            var p = x.split(':');
            return '<button class="s-' + p[0] + '" aria-pressed="' + (v === p[0]) + '" data-act="setAtt" data-s="' + s.id + '" data-v="' + p[0] + '">' + p[1] + '</button>';
          }).join('') + '</div></td><td><select aria-label="' + esc(s.full_name) + ' bahosi" data-change="grade" data-s="' + s.id + '"' + (v === 'present' ? '' : ' disabled') + '>' + opts + '</select></td><td>' + fine + '</td></tr>';
      });
      h += '<div class="card"><div class="row"><b>Davomat:</b> <span class="badge b-ok">Keldi: ' + np + '</span> <span class="badge b-warn">Sababli: ' + ne +
        '</span> <span class="badge b-bad">Kelmadi: ' + na + '</span>' +
        (l.status === 'open' ? '<span class="muted">Doskada belgilaganlar avtomatik chiqadi. Kechikkanni "Keldi" ni bosib qo\'shing.</span>' : '') +
        '</div><div class="tablewrap"><table><thead><tr><th>O\'quvchi</th><th>Davomat</th><th>Baho (1-10)</th><th>Jarima</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }
    return h;
  }

  // ---------- Darslar ----------
  function tabDarslar() {
    var t = today(), c = L.cfg(data), map = {};
    L.scheduledDates(c.start, t, data).forEach(function (d) { map[d] = true; });
    data.lessons.forEach(function (l) { map[l.lesson_date] = true; });
    var dates = Object.keys(map).sort().reverse();
    var rows = '';
    dates.forEach(function (d) {
      var l = lessonOn(d), hol = L.holidayOn(d, data.holidays);
      var cnt = l ? data.attendance.filter(function (a) { return a.lesson_id === l.id && a.status === 'present'; }).length : 0;
      rows += '<tr><td>' + L.dmy(d) + '</td><td>' + L.weekdayName(d) + '</td><td>' + statusBadge(l, hol) + '</td><td>' + esc(l ? l.topic : '') +
        '</td><td class="num">' + (l && l.status !== 'not_held' ? cnt : '') + '</td><td><button class="btn small" data-act="openDate" data-d="' + d + '">Ochish / tuzatish</button></td></tr>';
    });
    return '<div class="card"><h2>Barcha darslar</h2><div class="tablewrap"><table><thead><tr><th>Sana</th><th>Kun</th><th>Holat</th><th>Mavzu</th><th class="num">Keldi</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6" class="muted">Hali darslar yo\'q</td></tr>') + '</tbody></table></div></div>';
  }

  // ---------- O'quvchilar ----------
  function tabStudents() {
    var t = today(), c = L.cfg(data), rep = L.report(data, c.start, t);
    var rows = '';
    rep.rows.filter(function (r) { return r.student.status === 'active'; }).forEach(function (r) {
      rows += '<tr><td>' + esc(r.student.full_name) + '</td><td>' + L.dmy(r.student.joined_on) + '</td><td class="num">' + r.present + '</td><td class="num">' + r.absent +
        '</td><td class="num">' + (r.avg == null ? '&mdash;' : r.avg.toFixed(1)) + '</td><td class="num">' + (r.unpaidTotal ? fmt(r.unpaidTotal) : '0') +
        '</td><td><button class="btn small" data-act="renameStudent" data-s="' + r.student.id + '">Ismni o\'zgartirish</button> ' +
        '<button class="btn small danger" data-act="removeStudent" data-s="' + r.student.id + '">Guruhdan chiqarish</button></td></tr>';
    });
    var removed = data.students.filter(function (s) { return s.status === 'removed'; });
    var rrows = '';
    removed.forEach(function (s) {
      var due = L.purgeDue(data, t).some(function (x) { return x.id === s.id; });
      var left = Math.max(0, c.purge - Math.round((L.parse(t) - L.parse(s.removed_on)) / 864e5));
      rrows += '<tr><td>' + esc(s.full_name) + '</td><td>' + (s.removed_on ? L.dmy(s.removed_on) : '') + '</td><td>' + esc(s.remove_reason || '') + '</td><td>' +
        (due ? '<span class="badge b-warn">O\'chirish vaqti keldi</span>' : left + ' kun saqlanadi') + '</td><td>' +
        '<button class="btn small" data-act="reinstate" data-s="' + s.id + '">Qayta qabul qilish</button> ' +
        (due ? '<button class="btn small danger" data-act="purge" data-s="' + s.id + '">Ma\'lumotlarini o\'chirish</button>' : '') + '</td></tr>';
    });
    return '<div class="card"><h2>Yangi o\'quvchi qo\'shish</h2><form class="row" id="addForm"><input type="text" id="newName" class="grow" placeholder="Familiya Ism" aria-label="Familiya va ism" required>' +
      '<label for="newDate" class="muted">Qo\'shilgan sana:</label><input type="date" id="newDate" value="' + t + '"><button class="btn primary">Qo\'shish</button></form>' +
      '<p class="muted">Yangi o\'quvchi faqat qo\'shilgan sanadan boshlab hisoblanadi, oldingi darslar uchun jarima yozilmaydi.</p></div>' +
      '<div class="card"><h2>Guruh a\'zolari (' + rep.rows.filter(function (r) { return r.student.status === 'active'; }).length + ')</h2><div class="tablewrap"><table><thead><tr><th>O\'quvchi</th><th>Qo\'shilgan</th><th class="num">Keldi</th><th class="num">Kelmadi</th><th class="num">O\'rtacha</th><th class="num">Qarz (so\'m)</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7" class="muted">O\'quvchilar yo\'q</td></tr>') + '</tbody></table></div></div>' +
      '<div class="card"><h2>Chiqarilganlar</h2><p class="muted">Ma\'lumotlari ' + c.purge + ' kun ochilmay saqlanadi, keyin o\'chirish so\'raladi.</p><div class="tablewrap"><table><thead><tr><th>O\'quvchi</th><th>Chiqarilgan</th><th>Sabab</th><th>Holat</th><th></th></tr></thead><tbody>' +
      (rrows || '<tr><td colspan="5" class="muted">Chiqarilgan o\'quvchi yo\'q</td></tr>') + '</tbody></table></div></div>';
  }

  // ---------- Jarimalar ----------
  function tabFines() {
    var t = today(), c = L.cfg(data), rep = L.report(data, c.start, t);
    var h = '<div class="cards"><div class="stat"><b>' + fmt(rep.totals.all) + ' so\'m</b><span>Jami hisoblangan jarima</span></div>' +
      '<div class="stat"><b>' + fmt(rep.totals.paid) + ' so\'m</b><span>To\'langan (yig\'ilgan)</span></div>' +
      '<div class="stat"><b>' + fmt(rep.totals.unpaid) + ' so\'m</b><span>To\'lanmagan (qarz)</span></div></div>';
    var any = false;
    rep.rows.forEach(function (r) {
      if (!r.absent) return; any = true;
      var lines = '';
      r.cells.filter(function (x) { return x.kind === 'absent'; }).forEach(function (x) {
        lines += '<label class="checkline"><input type="checkbox" data-change="pay" data-s="' + r.student.id + '" data-d="' + x.date + '"' + (x.paid ? ' checked' : '') + '> ' +
          L.dmy(x.date) + ' (' + L.weekdayName(x.date) + '): ' + fmt(c.fine) + ' so\'m ' + (x.paid ? '<span class="badge b-ok">to\'langan</span>' : '<span class="badge b-bad">to\'lanmagan</span>') + '</label>';
      });
      h += '<div class="card"><div class="row"><h3 class="grow">' + esc(r.student.full_name) + (r.student.status === 'removed' ? ' (chiqarilgan)' : '') + '</h3>' +
        '<span>Jami: <b>' + fmt(r.fineTotal) + '</b></span><span>Qarz: <b>' + fmt(r.unpaidTotal) + '</b></span>' +
        (r.unpaidCount ? '<button class="btn small" data-act="payAll" data-s="' + r.student.id + '">Hammasi to\'landi</button>' : '') + '</div>' + lines + '</div>';
    });
    if (!any) h += '<div class="card muted">Hozircha jarima yo\'q.</div>';
    return h + '<p class="muted">Jarima har bir qoldirilgan dars uchun ' + fmt(c.fine) + ' so\'m. Kechikkan o\'quvchi "Keldi" deb belgilansa, jarimasi avtomatik bekor bo\'ladi.</p>';
  }

  // ---------- Oy hisobi ----------
  function monthOptions() {
    var c = L.cfg(data), cur = L.monthOf(today()), m = L.monthOf(c.start), o = '';
    while (m <= cur) { o += '<option value="' + m + '"' + (selMonth === m ? ' selected' : '') + '>' + L.monthName(m) + '</option>'; m = L.nextMonth(m); }
    return o + '<option value="all"' + (selMonth === 'all' ? ' selected' : '') + '>Boshidan hozirgacha</option>';
  }
  function getReport() {
    var c = L.cfg(data);
    return selMonth === 'all' ? L.report(data, c.start, today()) : L.monthReport(data, selMonth);
  }
  function tabMonth() {
    var c = L.cfg(data), rep = getReport(), closed = data.closings.some(function (x) { return x.month === selMonth; });
    var title = selMonth === 'all' ? 'Boshidan hozirgacha' : L.monthName(selMonth);
    var h = '<div class="card"><div class="row"><label for="monthSel"><b>Davr:</b></label><select id="monthSel" data-change="month">' + monthOptions() + '</select>' +
      '<span class="muted">' + L.dmy(rep.from) + ' &ndash; ' + L.dmy(rep.to) + '</span><span class="grow"></span>' +
      '<button class="btn primary" data-act="pdf">PDF yuklab olish (ota-onalar uchun)</button></div></div>';
    h += '<div class="cards"><div class="stat"><b>' + rep.held.length + '</b><span>O\'tilgan darslar</span></div><div class="stat"><b>' + rep.notHeld.length + '</b><span>O\'tilmagan darslar</span></div>' +
      '<div class="stat"><b>' + fmt(rep.totals.all) + '</b><span>Hisoblangan jarima (so\'m)</span></div><div class="stat"><b>' + fmt(rep.totals.paid) + '</b><span>To\'langan (so\'m)</span></div>' +
      '<div class="stat"><b>' + fmt(rep.totals.unpaid) + '</b><span>Qarz (so\'m)</span></div></div>';
    if (selMonth !== 'all') {
      var info = L.removalInfo(rep, data);
      if (info.candidates.length) {
        h += '<div class="card"><h3>Guruhdan chiqariladiganlar (oyda ' + info.limit + ' ta va undan ko\'p dars qoldirgan)</h3>';
        info.candidates.forEach(function (r) {
          h += '<div class="row"><span class="grow"><b>' + esc(r.student.full_name) + '</b>: ' + r.absent + ' ta qoldirgan</span>' +
            '<button class="btn small danger" data-act="removeStudent" data-s="' + r.student.id + '" data-reason="' + esc(L.monthName(selMonth) + ' oyida ' + r.absent + ' ta dars qoldirdi') + '">Guruhdan chiqarish</button></div>';
        });
        h += '</div>';
      }
      if (info.warnings.length) h += '<div class="banner warn">Ogohlantirish (' + info.limit + ' ga yaqin): ' + info.warnings.map(function (r) { return esc(r.student.full_name) + ' (' + r.absent + ')'; }).join(', ') + '</div>';
    }
    var rows = '';
    rep.rows.forEach(function (r) {
      rows += '<tr><td>' + esc(r.student.full_name) + (r.student.status === 'removed' ? ' <span class="badge b-warn">chiqarilgan</span>' : '') + '</td><td class="num">' + r.present + '</td><td class="num">' + r.absent +
        '</td><td class="dates">' + (r.absentDates.map(L.dm).join(', ') || '&mdash;') + '</td><td class="num">' + (r.avg == null ? '&mdash;' : r.avg.toFixed(1)) +
        '</td><td class="num">' + fmt(r.fineTotal) + '</td><td class="num">' + fmt(r.paidTotal) + '</td><td class="num">' + fmt(r.unpaidTotal) + '</td></tr>';
    });
    h += '<div class="card"><h2>' + esc(title) + '</h2><div class="tablewrap"><table><thead><tr><th>O\'quvchi</th><th class="num">Keldi</th><th class="num">Kelmadi</th><th>Qaysi kunlari</th><th class="num">O\'rtacha baho</th><th class="num">Jarima</th><th class="num">To\'langan</th><th class="num">Qarz</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="8" class="muted">Bu davrda ma\'lumot yo\'q</td></tr>') + '</tbody></table></div></div>';
    if (rep.held.length) {
      h += '<div class="card"><h3>Darslar mavzulari</h3>' + rep.held.map(function (l) { return '<div>' + L.dm(l.lesson_date) + ': ' + esc(l.topic || 'mavzu kiritilmagan') + '</div>'; }).join('') + '</div>';
    }
    if (selMonth !== 'all') {
      h += '<div class="card"><p>Informatika sinfi uchun yig\'ilgan (to\'langan) jarima: <b>' + fmt(rep.totals.paid) + ' so\'m</b>. Nima sotib olinishi oy oxirida muhokama qilinadi.</p>' +
        (closed ? '<span class="badge b-ok">Oy hisobi yopilgan</span> <button class="btn small" data-act="reopenMonth">Qayta ochish</button>'
          : '<button class="btn primary" data-act="closeMonth">Oy hisobini yopish</button>') + '</div>';
    }
    return h;
  }

  // ---------- Ta'tillar ----------
  function tabHolidays() {
    var rows = '', list = data.holidays.slice().sort(function (a, b) { return a.date_from < b.date_from ? -1 : 1; });
    list.forEach(function (x) {
      rows += '<tr><td>' + L.dmy(x.date_from) + (x.date_to !== x.date_from ? ' &ndash; ' + L.dmy(x.date_to) : '') + '</td><td>' + esc(x.reason) +
        '</td><td><button class="btn small danger" data-act="delHoliday" data-id="' + x.id + '">O\'chirish</button></td></tr>';
    });
    return '<div class="card"><h2>Bayram va chorak ta\'tili</h2><p class="muted">Bu kunlarga to\'g\'ri kelgan darslar hisoblanmaydi (jarima ham yo\'q). Oy oxirgi darsi ham shunga qarab aniqlanadi.</p>' +
      '<form class="row" id="holForm"><label for="hf">Dan:</label><input type="date" id="hf" required><label for="ht">Gacha:</label><input type="date" id="ht" required>' +
      '<input type="text" id="hr" class="grow" placeholder="Sababi (masalan: chorak ta\'tili)" aria-label="Sababi"><button class="btn primary">Qo\'shish</button></form>' +
      '<div class="tablewrap"><table><thead><tr><th>Sana</th><th>Sababi</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="3" class="muted">Hozircha yo\'q</td></tr>') + '</tbody></table></div></div>';
  }

  function tabTerms() {
    return '<div class="card">' + window.TERMS_HTML + '<p class="muted">Bu matn doskada ham "To\'garak shartlari" tugmasi orqali ochiladi.</p></div>';
  }

  // ---------- PDF ----------
  function makePdf(rep, title) {
    var c = L.cfg(data), jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('Informatika to\'garagi: ' + title, 14, 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('Davr: ' + L.dmy(rep.from) + ' - ' + L.dmy(rep.to) + '.  O\'tilgan darslar: ' + rep.held.length + '.  O\'tilmagan darslar: ' + rep.notHeld.length +
      '.  Jarima: har bir qoldirilgan dars uchun ' + fmt(c.fine) + ' so\'m.', 14, 21);
    var head = ['T/r', 'O\'quvchi'].concat(rep.held.map(function (l) { return L.dm(l.lesson_date); }), ['Keldi', 'Qoldirdi', 'O\'rtacha', 'Jarima', 'To\'langan', 'Qarz']);
    var body = rep.rows.map(function (r, i) {
      var cells = r.cells.map(function (x) {
        return x.kind === 'present' ? (x.grade ? String(x.grade) : '+') : x.kind === 'excused' ? 'S' : x.kind === 'absent' ? '-' : '';
      });
      return [String(i + 1), r.student.full_name + (r.student.status === 'removed' ? ' (chiqarilgan)' : '')].concat(cells,
        [String(r.present), String(r.absent), r.avg == null ? '-' : r.avg.toFixed(1), fmt(r.fineTotal), fmt(r.paidTotal), fmt(r.unpaidTotal)]);
    });
    var foot = ['', 'JAMI'].concat(rep.held.map(function () { return ''; }), ['', '', '', fmt(rep.totals.all), fmt(rep.totals.paid), fmt(rep.totals.unpaid)]);
    var nLessons = rep.held.length, fs = nLessons > 12 ? 7 : 8.5, firstDate = 2, lastDate = 1 + nLessons;
    doc.autoTable({
      head: [head], body: body, foot: [foot], startY: 26, theme: 'grid',
      styles: { font: 'helvetica', fontSize: fs, cellPadding: 1.6, halign: 'center', valign: 'middle' },
      headStyles: { fillColor: [58, 91, 217], textColor: 255 }, footStyles: { fillColor: [235, 238, 250], textColor: 20, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'left', cellWidth: 52 } },
      didParseCell: function (h) {
        if (h.section === 'body' && h.column.index >= firstDate && h.column.index <= lastDate && h.cell.raw === '-') h.cell.styles.textColor = [200, 40, 40];
        if (h.section === 'body' && h.column.index === head.length - 1 && h.cell.raw !== '0') h.cell.styles.textColor = [200, 40, 40];
      }
    });
    var y = doc.lastAutoTable.finalY + 6;
    function line(text, size, bold) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size || 9);
      doc.splitTextToSize(text, 268).forEach(function (t) {
        if (y > 198) { doc.addPage(); y = 14; }
        doc.text(t, 14, y); y += (size || 9) * 0.5 + 1;
      });
    }
    line('Belgilar: son - dars bahosi (1-10); + - keldi (baho qo\'yilmagan); - - kelmadi (jarima hisoblanadi); S - sababli, jarima yo\'q.', 8.5);
    line('Qarz - hali to\'lanmagan jarima. To\'langan jarima informatika sinfi ehtiyojlari uchun sarflanadi.', 8.5);
    y += 2;
    if (rep.held.length) {
      line('Darslar mavzulari:', 10, true);
      rep.held.forEach(function (l) { line(L.dm(l.lesson_date) + ' - ' + (l.topic || 'mavzu kiritilmagan'), 9); });
    }
    y += 2; line('Hisobot sanasi: ' + L.dmy(today()), 8.5);
    return doc;
  }

  // ---------- amallar ----------
  var actions = {
    goTab: function (e) { tab = e.t; return 'render'; },
    goToday: function () { selDate = today(); return 'render'; },
    goMonth: function (e) { tab = 'oy'; selMonth = e.m; return 'render'; },
    openDate: function (e) { tab = 'dars'; selDate = e.d; return 'render'; },
    logout: async function () { await API.logout(); data = null; showLogin(); return 'stop'; },

    openLesson: async function () {
      var other = data.lessons.find(function (l) { return l.status === 'open' && l.lesson_date !== selDate; });
      if (other) { alert(L.dmy(other.lesson_date) + ' dagi dars hali ochiq. Avval uni yakunlang.'); return; }
      await API.saveLesson(selDate, { status: 'open', topic: $('#topic').value.trim() });
    },
    reopen: async function () {
      var other = data.lessons.find(function (l) { return l.status === 'open' && l.lesson_date !== selDate; });
      if (other) { alert(L.dmy(other.lesson_date) + ' dagi dars hali ochiq. Avval uni yakunlang.'); return; }
      await API.saveLesson(selDate, { status: 'open', topic: $('#topic').value.trim() });
    },
    saveTopic: async function () { await API.saveLesson(selDate, { topic: $('#topic').value.trim() }); },
    finish: async function () {
      var l = lessonOn(selDate), c = L.cfg(data);
      var absent = data.students.filter(function (s) { return L.eligible(s, selDate) && !attOf(l.id, s.id); }).length;
      var topic = $('#topic').value.trim();
      if (!topic && !confirm('Mavzu kiritilmagan. Shunday yakunlansinmi?')) return;
      if (!confirm('Dars o\'tildi deb yakunlansinmi?\nKelmaganlar: ' + absent + ' ta, jarima: ' + fmt(absent * c.fine) + ' so\'m.')) return;
      await API.saveLesson(selDate, { status: 'held', topic: topic });
    },
    notHeld: async function () {
      if (!confirm('Bu dars "o\'tilmadi" deb belgilansinmi? Hech kimga jarima yozilmaydi.')) return;
      await API.saveLesson(selDate, { status: 'not_held', topic: ($('#topic').value || '').trim() });
    },
    setAtt: async function (e) {
      var l = lessonOn(selDate); if (!l) return;
      var cur = attOf(l.id, e.s), curV = cur ? cur.status : 'absent';
      if (curV === e.v) return;
      await API.setAttendance(l.id, e.s, e.v === 'absent' ? null : e.v);
      if (e.v !== 'absent') {
        var p = payOf(l.id, e.s);
        if (p) { await API.setPayment(l.id, e.s, false); alert('Bu o\'quvchi jarimani to\'lagan edi. Jarima bekor qilindi, to\'langan pulni qaytarib bering.'); }
      }
    },
    addStudent: async function () {
      var name = $('#newName').value.trim().replace(/\s+/g, ' ');
      if (!name) return;
      if (data.students.some(function (s) { return s.full_name.toLowerCase() === name.toLowerCase() && s.status === 'active'; }) &&
        !confirm('"' + name + '" ro\'yxatda bor. Baribir qo\'shilsinmi?')) return;
      await API.addStudent(name, $('#newDate').value || today());
    },
    renameStudent: async function (e) {
      var s = stu(e.s), n = prompt('Yangi ism:', s.full_name);
      if (n && n.trim()) await API.updateStudent(s.id, { full_name: n.trim() });
    },
    removeStudent: async function (e) {
      var s = stu(e.s), reason = e.reason || prompt('"' + s.full_name + '" guruhdan chiqarilsinmi?\nSababini yozing:', 'Oy hisobi bo\'yicha');
      if (reason === null) return;
      if (e.reason && !confirm('"' + s.full_name + '" guruhdan chiqarilsinmi?')) return;
      await API.updateStudent(s.id, { status: 'removed', removed_on: today(), remove_reason: reason });
    },
    reinstate: async function (e) {
      var s = stu(e.s);
      if (!confirm('"' + s.full_name + '" guruhga qayta qabul qilinsinmi?')) return;
      await API.updateStudent(s.id, { status: 'active', removed_on: null, remove_reason: null });
    },
    purge: async function (e) {
      var s = stu(e.s);
      if (!confirm('"' + s.full_name + '" ning barcha ma\'lumotlari (davomat, baho, jarima) butunlay o\'chiriladi. Davom etasizmi?')) return;
      await API.deleteStudent(s.id);
    },
    payAll: async function (e) {
      var c = L.cfg(data), rep = L.report(data, c.start, today()), r = rep.rows.find(function (x) { return x.student.id === e.s; });
      for (var i = 0; i < r.cells.length; i++) {
        var x = r.cells[i];
        if (x.kind === 'absent' && !x.paid) await API.setPayment(lessonOn(x.date).id, e.s, true, c.fine);
      }
    },
    addHoliday: async function () {
      var f = $('#hf').value, t = $('#ht').value;
      if (!f || !t) return;
      if (t < f) { alert('"Gacha" sanasi "Dan" sanasidan oldin bo\'lmasligi kerak.'); return; }
      await API.addHoliday(f, t, $('#hr').value.trim());
    },
    delHoliday: async function (e) { if (confirm('Ta\'til o\'chirilsinmi?')) await API.deleteHoliday(e.id); },
    closeMonth: async function () {
      var rep = getReport(), info = L.removalInfo(rep, data);
      var msg = L.monthName(selMonth) + ' oy hisobi yopilsinmi?';
      if (info.candidates.length) msg += '\n\nDiqqat: ' + info.candidates.length + ' ta o\'quvchi chiqarilishi kerak (hali chiqarilmagan).';
      if (confirm(msg)) await API.closeMonth(selMonth);
    },
    reopenMonth: async function () { await API.reopenMonth(selMonth); },
    pdf: function () {
      var rep = getReport(), title = selMonth === 'all' ? 'umumiy hisobot' : 'oy hisoboti, ' + L.monthName(selMonth);
      makePdf(rep, title).save('yoqlama-hisobot-' + (selMonth === 'all' ? 'umumiy' : selMonth) + '.pdf');
      return 'stop';
    }
  };

  var changes = {
    pickDate: function (el) { if (el.value) selDate = el.value; return 'render'; },
    month: function (el) { selMonth = el.value; return 'render'; },
    grade: async function (el) {
      var l = lessonOn(selDate);
      await API.setGrade(l.id, el.getAttribute('data-s'), el.value === '' ? null : Number(el.value));
    },
    pay: async function (el) {
      var l = lessonOn(el.getAttribute('data-d')), c = L.cfg(data);
      await API.setPayment(l.id, el.getAttribute('data-s'), el.checked, c.fine);
    }
  };

  var busy = false;
  async function run(fn, arg) {
    if (busy) return; busy = true;
    try {
      var r = await fn(arg);
      if (r === 'stop') return;
      if (r === 'render') { render(); return; }
      data = await API.loadAll(); render();
    } catch (err) {
      alert('Xatolik: ' + (err && err.message ? err.message : err));
      try { data = await API.loadAll(); render(); } catch (e2) { /* tarmoq yo'q */ }
    } finally { busy = false; }
  }

  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el || !actions[el.getAttribute('data-act')]) return;
    var args = {}; Array.prototype.forEach.call(el.attributes, function (a) { if (a.name.indexOf('data-') === 0) args[a.name.slice(5)] = a.value; });
    run(actions[el.getAttribute('data-act')], args);
  });
  root.addEventListener('change', function (e) {
    var k = e.target.getAttribute && e.target.getAttribute('data-change'); if (!k || !changes[k]) return;
    run(changes[k], e.target);
  });
  root.addEventListener('submit', function (e) {
    var id = e.target.id; if (id === 'loginForm') return;
    e.preventDefault();
    var m = { addForm: 'addStudent', holForm: 'addHoliday' }[id];
    if (m) run(actions[m], {});
  });

  // doskada belgilanganlarni avtomatik yangilash
  setInterval(async function () {
    if (!data || tab !== 'dars' || busy) return;
    var l = lessonOn(selDate); if (!l || l.status !== 'open') return;
    var ae = document.activeElement; if (ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) return;
    try {
      var nd = await API.loadAll();
      if (JSON.stringify(nd.attendance) !== JSON.stringify(data.attendance) && !busy) { data = nd; render(); }
    } catch (e) { /* keyingi safar */ }
  }, 6000);

  (async function boot() {
    if (!API.configured) { showSetup(); return; }
    try { if (await API.hasSession()) { await load(); return; } } catch (e) { /* kirish oynasi */ }
    showLogin();
  })();
})();
