/* Supabase bilan aloqa. Sayt boshqa joyda bazaga to'g'ridan-to'g'ri murojaat qilmaydi. */
(function () {
  'use strict';
  if (window.__MOCK_API__) { window.API = window.__MOCK_API__; return; }

  var cfg = window.APP_CONFIG || {};
  var configured = typeof cfg.SUPABASE_URL === 'string' && /^https?:\/\//.test(cfg.SUPABASE_URL) &&
    cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_ANON_KEY.indexOf('BU_YERGA') !== 0;
  var sb = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  function need() {
    if (!sb) throw new Error('js/config.js ichiga Supabase manzili va kaliti yozilmagan.');
    return sb;
  }
  async function unwrap(p) {
    var r = await p;
    if (r.error) throw new Error(r.error.message || 'Baza xatosi');
    return r.data;
  }
  function table(name) { return need().from(name); }

  window.API = {
    configured: !!sb,

    // ---- doska (o'quvchilar), kirishsiz ----
    doskaState: function () { return unwrap(need().rpc('doska_state')); },
    doskaMark: function (id) { return unwrap(need().rpc('doska_mark', { p_student: id })); },

    // ---- admin ----
    login: async function (login, password) {
      var email = String(login).trim().toLowerCase() + '@' + cfg.ADMIN_EMAIL_DOMAIN;
      var r = await need().auth.signInWithPassword({ email: email, password: password });
      if (r.error) throw new Error('Login yoki parol noto\'g\'ri');
    },
    logout: async function () { await need().auth.signOut(); },
    hasSession: async function () {
      var r = await need().auth.getSession();
      return !!(r.data && r.data.session);
    },
    loadAll: async function () {
      var res = await Promise.all([
        unwrap(table('students').select('*')),
        unwrap(table('lessons').select('*')),
        unwrap(table('attendance').select('*')),
        unwrap(table('fine_payments').select('*')),
        unwrap(table('holidays').select('*')),
        unwrap(table('settings').select('*')),
        unwrap(table('month_closings').select('*'))
      ]);
      var settings = {};
      res[5].forEach(function (s) { settings[s.key] = s.value; });
      return { students: res[0], lessons: res[1], attendance: res[2], payments: res[3], holidays: res[4], settings: settings, closings: res[6] };
    },
    saveLesson: async function (date, patch) { // dars yaratadi yoki yangilaydi
      var ex = await unwrap(table('lessons').select('id').eq('lesson_date', date).maybeSingle());
      if (ex) return unwrap(table('lessons').update(patch).eq('id', ex.id));
      return unwrap(table('lessons').insert(Object.assign({ lesson_date: date }, patch)));
    },
    setAttendance: async function (lessonId, studentId, status) { // status: 'present' | 'excused' | null (kelmadi)
      if (!status) return unwrap(table('attendance').delete().eq('lesson_id', lessonId).eq('student_id', studentId));
      var row = { lesson_id: lessonId, student_id: studentId, status: status, marked_by: 'admin', marked_at: new Date().toISOString() };
      if (status !== 'present') row.grade = null;
      return unwrap(table('attendance').upsert(row, { onConflict: 'lesson_id,student_id' }));
    },
    setGrade: function (lessonId, studentId, grade) {
      return unwrap(table('attendance').update({ grade: grade }).eq('lesson_id', lessonId).eq('student_id', studentId));
    },
    setPayment: async function (lessonId, studentId, paid, amount) {
      if (!paid) return unwrap(table('fine_payments').delete().eq('lesson_id', lessonId).eq('student_id', studentId));
      return unwrap(table('fine_payments').upsert(
        { lesson_id: lessonId, student_id: studentId, amount: amount },
        { onConflict: 'lesson_id,student_id' }));
    },
    addStudent: function (name, joinedOn) {
      return unwrap(table('students').insert({ full_name: name, joined_on: joinedOn }));
    },
    updateStudent: function (id, patch) { return unwrap(table('students').update(patch).eq('id', id)); },
    deleteStudent: function (id) { return unwrap(table('students').delete().eq('id', id)); },
    addHoliday: function (from, to, reason) {
      return unwrap(table('holidays').insert({ date_from: from, date_to: to, reason: reason }));
    },
    deleteHoliday: function (id) { return unwrap(table('holidays').delete().eq('id', id)); },
    closeMonth: function (month) { return unwrap(table('month_closings').upsert({ month: month }, { onConflict: 'month' })); },
    reopenMonth: function (month) { return unwrap(table('month_closings').delete().eq('month', month)); }
  };
})();
