/* Hisob-kitob mantig'i (bazadan mustaqil, alohida sinab ko'rilgan).
   Brauzerda ham, Node'da ham ishlaydi. */
(function (root) {
  'use strict';

  var SCHEDULE_DAYS = [1, 4, 5]; // dushanba, payshanba, juma

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function todayStr() { return (root.__TODAY__) || ymd(new Date()); } // __TODAY__ faqat sinov uchun
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  function monthOf(s) { return s.slice(0, 7); }
  function monthFirst(m) { return m + '-01'; }
  function monthLast(m) {
    var p = m.split('-'); var d = new Date(+p[0], +p[1], 0); return ymd(d);
  }
  function prevMonth(m) { var p = m.split('-'); var d = new Date(+p[0], +p[1] - 2, 1); return ymd(d).slice(0, 7); }
  function nextMonth(m) { var p = m.split('-'); var d = new Date(+p[0], +p[1], 1); return ymd(d).slice(0, 7); }
  function dm(s) { return s.slice(8, 10) + '.' + s.slice(5, 7); }       // 16.10
  function dmy(s) { return dm(s) + '.' + s.slice(0, 4); }               // 16.10.2026

  var MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
  var WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
  function monthName(m) { return MONTHS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); }
  function weekdayName(s) { return WEEKDAYS[parse(s).getDay()]; }

  function holidayOn(s, holidays) {
    for (var i = 0; i < (holidays || []).length; i++) {
      var h = holidays[i];
      if (s >= h.date_from && s <= h.date_to) return h;
    }
    return null;
  }

  function num(v, d) { var n = Number(v); return isFinite(n) && v !== '' && v != null ? n : d; }
  function cfg(data) {
    var s = data.settings || {};
    return {
      start: s.start_date || '2026-10-16',
      fine: num(s.fine_amount, 5000),
      limit: num(s.removal_limit, 6),
      purge: num(s.purge_days, 14)
    };
  }

  // Dars jadvali bo'yicha kunlar (bayram/ta'til kunlarisiz)
  function scheduledDates(from, to, data) {
    var c = cfg(data), out = [];
    var d = from < c.start ? c.start : from;
    while (d <= to) {
      if (SCHEDULE_DAYS.indexOf(parse(d).getDay()) >= 0 && !holidayOn(d, data.holidays)) out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }

  function eligible(st, dateStr) {
    if (dateStr < st.joined_on) return false;
    if (st.removed_on && dateStr > st.removed_on) return false;
    return true;
  }

  // Hisobga olinadigan darslar: boshlanish sanasidan keyin, bayram/ta'til kuni emas
  function countedLessons(data, from, to) {
    var c = cfg(data);
    return (data.lessons || []).filter(function (l) {
      return l.lesson_date >= c.start && l.lesson_date >= from && l.lesson_date <= to &&
        !holidayOn(l.lesson_date, data.holidays);
    }).sort(function (a, b) { return a.lesson_date < b.lesson_date ? -1 : 1; });
  }

  function studentStats(data, st, held) {
    var c = cfg(data);
    var att = {}, pay = {};
    (data.attendance || []).forEach(function (a) { att[a.lesson_id + '|' + a.student_id] = a; });
    (data.payments || []).forEach(function (p) { pay[p.lesson_id + '|' + p.student_id] = p; });
    var r = {
      student: st, present: 0, absent: 0, excused: 0, eligibleCount: 0,
      avg: null, absentDates: [], cells: [],
      paidCount: 0, paidTotal: 0, unpaidCount: 0, unpaidTotal: 0
    };
    var gSum = 0, gN = 0;
    held.forEach(function (L) {
      var key = L.id + '|' + st.id;
      if (!eligible(st, L.lesson_date)) { r.cells.push({ kind: 'na', date: L.lesson_date }); return; }
      var a = att[key];
      if (a && a.status === 'present') {
        r.present++;
        if (a.grade) { gSum += a.grade; gN++; }
        r.cells.push({ kind: 'present', grade: a.grade || null, date: L.lesson_date });
      } else if (a && a.status === 'excused') {
        r.excused++;
        r.cells.push({ kind: 'excused', date: L.lesson_date });
      } else {
        r.absent++;
        r.absentDates.push(L.lesson_date);
        var p = pay[key];
        if (p) { r.paidCount++; r.paidTotal += num(p.amount, c.fine); }
        r.cells.push({ kind: 'absent', paid: !!p, date: L.lesson_date });
      }
    });
    r.eligibleCount = r.present + r.absent + r.excused;
    r.avg = gN ? gSum / gN : null;
    r.unpaidCount = r.absent - r.paidCount;
    r.unpaidTotal = r.unpaidCount * c.fine;
    r.fineCount = r.absent;
    r.fineTotal = r.paidTotal + r.unpaidTotal;
    return r;
  }

  // Davr bo'yicha to'liq hisobot (oy yoki hammasi)
  function report(data, from, to) {
    var lessons = countedLessons(data, from, to);
    var held = lessons.filter(function (l) { return l.status === 'held'; });
    var notHeld = lessons.filter(function (l) { return l.status === 'not_held'; });
    var rows = [];
    (data.students || []).forEach(function (st) {
      var s = studentStats(data, st, held);
      if (st.status === 'active' || s.eligibleCount > 0) rows.push(s);
    });
    rows.sort(function (a, b) { return a.student.full_name.localeCompare(b.student.full_name); });
    var tot = { paid: 0, unpaid: 0, all: 0 };
    rows.forEach(function (r) { tot.paid += r.paidTotal; tot.unpaid += r.unpaidTotal; tot.all += r.fineTotal; });
    return { from: from, to: to, held: held, notHeld: notHeld, rows: rows, totals: tot };
  }

  function monthReport(data, month) {
    var c = cfg(data);
    var from = monthFirst(month); if (from < c.start) from = c.start;
    return report(data, from, monthLast(month));
  }

  function lastLessonDate(month, data) {
    var c = cfg(data);
    var from = monthFirst(month); if (from < c.start) from = c.start;
    var list = scheduledDates(from, monthLast(month), data);
    return list.length ? list[list.length - 1] : null;
  }

  // Oy hisobi eslatmalari
  function monthReminders(data, today) {
    var c = cfg(data), out = [];
    var closed = {}; (data.closings || []).forEach(function (x) { closed[x.month] = true; });
    var cur = monthOf(today), m = monthOf(c.start);
    while (m <= cur) {
      var last = lastLessonDate(m, data);
      if (last && !closed[m]) {
        if (m < cur || today > last) out.push({ month: m, type: 'overdue', last: last });
        else if (today === last) out.push({ month: m, type: 'today', last: last });
      }
      m = nextMonth(m);
    }
    return out;
  }

  // Oyda limitga yetgan o'quvchilar (chiqarish tavsiyasi) va ogohlantirishlar
  function removalInfo(rep, data) {
    var c = cfg(data), cand = [], warn = [];
    rep.rows.forEach(function (r) {
      if (r.student.status !== 'active') return;
      if (r.absent >= c.limit) cand.push(r);
      else if (r.absent >= c.limit - 2) warn.push(r);
    });
    return { candidates: cand, warnings: warn, limit: c.limit };
  }

  function purgeDue(data, today) {
    var c = cfg(data);
    return (data.students || []).filter(function (s) {
      return s.status === 'removed' && s.removed_on && addDays(s.removed_on, c.purge) <= today;
    });
  }

  // Hali hal qilinmagan o'tgan kunlar: jadvalda bor, lekin dars belgilanmagan
  function pendingDates(data, today) {
    var c = cfg(data);
    var have = {}; (data.lessons || []).forEach(function (l) { have[l.lesson_date] = true; });
    return scheduledDates(c.start, today, data).filter(function (d) { return !have[d]; });
  }

  function sum(n) { // 15000 -> "15 000"
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  var api = {
    SCHEDULE_DAYS: SCHEDULE_DAYS, ymd: ymd, parse: parse, todayStr: todayStr, addDays: addDays,
    monthOf: monthOf, monthFirst: monthFirst, monthLast: monthLast, prevMonth: prevMonth, nextMonth: nextMonth,
    dm: dm, dmy: dmy, monthName: monthName, weekdayName: weekdayName,
    holidayOn: holidayOn, cfg: cfg, scheduledDates: scheduledDates, eligible: eligible,
    countedLessons: countedLessons, studentStats: studentStats, report: report, monthReport: monthReport,
    lastLessonDate: lastLessonDate, monthReminders: monthReminders, removalInfo: removalInfo,
    purgeDue: purgeDue, pendingDates: pendingDates, sum: sum
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Logic = api;
})(typeof window !== 'undefined' ? window : this);
