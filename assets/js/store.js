/*
 * Progreso del curso en localStorage (solo en este navegador).
 * Todas las lecturas/escrituras van protegidas: si el almacenamiento no está
 * disponible (modo privado, vista previa), la app funciona igual sin guardar.
 */
(function (global) {
  'use strict';

  var KEY = 'swiftui-sobre-kmp:v1';

  function fresh() {
    return { completed: {}, quiz: {}, challenges: {}, checklist: {}, game: {}, last: null, theme: null };
  }

  var state = fresh();
  try {
    var raw = global.localStorage && global.localStorage.getItem(KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') state = Object.assign(fresh(), parsed);
    }
  } catch (e) { /* sin almacenamiento: seguimos en memoria */ }

  function save() {
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignorado */ }
  }

  global.CursoStore = {
    isDone: function (id) { return !!state.completed[id]; },
    setDone: function (id, done) {
      if (done) state.completed[id] = Date.now(); else delete state.completed[id];
      save();
    },
    doneCount: function (ids) { return ids.filter(function (id) { return !!state.completed[id]; }).length; },

    quiz: function (id) { return state.quiz[id] || null; },
    setQuiz: function (id, data) { state.quiz[id] = data; save(); },
    clearQuiz: function (id) { delete state.quiz[id]; save(); },

    challenge: function (id) { return state.challenges[id] || null; },
    setChallenge: function (id, data) { state.challenges[id] = data; save(); },

    checked: function (id) { return !!state.checklist[id]; },
    setChecked: function (id, value) {
      if (value) state.checklist[id] = true; else delete state.checklist[id];
      save();
    },
    clearChecklist: function () { state.checklist = {}; save(); },

    game: function () { return state.game || {}; },
    setGameAnswer: function (index, layer) { state.game = state.game || {}; state.game[index] = layer; save(); },
    clearGame: function () { state.game = {}; save(); },

    last: function () { return state.last; },
    setLast: function (id) { state.last = id; save(); },

    theme: function () { return state.theme; },
    setTheme: function (theme) { state.theme = theme; save(); },

    resetAll: function () {
      var theme = state.theme;
      state = fresh();
      state.theme = theme;
      save();
    }
  };
})(window);
