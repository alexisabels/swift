/*
 * Registro de contenido y mini-DSL para escribir lecciones.
 * Sin dependencias. Se carga como script clásico (funciona con file://).
 *
 * Los ficheros de assets/content/*.js usan este patrón:
 *
 *   (function () {
 *     const { p, h, code, compare, tabs, note, list, steps, table, keys, diagram, q, S } = Curso.dsl;
 *     Curso.module({ ... });
 *   })();
 */
(function (global) {
  'use strict';

  var Curso = global.Curso || (global.Curso = {});

  Curso.modules = [];
  Curso.challenges = [];
  Curso.glossaryItems = [];
  Curso.checklistGroups = [];
  Curso.interopItems = [];
  Curso.architecture = null;

  Curso.module = function (def) { Curso.modules.push(def); return def; };
  Curso.challenge = function (def) { Curso.challenges.push(def); return def; };
  Curso.glossary = function (items) { Array.prototype.push.apply(Curso.glossaryItems, items); };
  Curso.checklist = function (groups) { Array.prototype.push.apply(Curso.checklistGroups, groups); };
  Curso.interop = function (items) { Array.prototype.push.apply(Curso.interopItems, items); };
  Curso.setArchitecture = function (def) { Curso.architecture = def; };

  /**
   * Normaliza un bloque de código escrito con String.raw:
   * - quita líneas en blanco al principio y al final,
   * - elimina la indentación común,
   * - recorta espacios al final de cada línea.
   * La línea 1 es la primera línea no vacía (importante para los retos).
   */
  Curso.dedent = function (src) {
    if (src == null) return '';
    var lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    while (lines.length && /^\s*$/.test(lines[0])) lines.shift();
    while (lines.length && /^\s*$/.test(lines[lines.length - 1])) lines.pop();
    var min = Infinity;
    lines.forEach(function (l) {
      if (/\S/.test(l)) {
        var n = l.match(/^[ \t]*/)[0].length;
        if (n < min) min = n;
      }
    });
    if (!isFinite(min)) min = 0;
    return lines.map(function (l) { return l.slice(min).replace(/\s+$/, ''); }).join('\n');
  };

  Curso.LANGS = ['swift', 'kotlin', 'gradle', 'bash', 'text', 'json'];
  Curso.NOTE_KINDS = ['tip', 'warn', 'kmp', 'new', 'info'];
  Curso.LEVELS = ['Básico', 'Intermedio', 'Avanzado'];
  Curso.ICONS = ['swift', 'bolt', 'layout', 'bridge', 'flask', 'compass', 'wrench'];
  Curso.DIAGRAMS = ['arquitectura', 'flujo', 'puente'];

  Curso.dsl = {
    /** Párrafo. Admite `código`, **negrita**, *cursiva* y [enlaces](#/l/id). */
    p: function (md) { return { type: 'p', md: md }; },
    /** Subtítulo de sección (aparece en el índice de la lección). */
    h: function (md) { return { type: 'h', md: md }; },
    /** Bloque de código. lang: swift | kotlin | gradle | bash | text | json */
    code: function (lang, src, title) { return { type: 'code', lang: lang, code: src, title: title || '' }; },
    /** Comparativa ❌ evita / ✅ recomendado. notes: { bad, good, badTitle, goodTitle } (md) */
    compare: function (lang, bad, good, notes) {
      notes = notes || {};
      return {
        type: 'compare', lang: lang, bad: bad, good: good,
        badNote: notes.bad || '', goodNote: notes.good || '',
        badTitle: notes.badTitle || '', goodTitle: notes.goodTitle || ''
      };
    },
    /** Pestañas de código: [[etiqueta, lang, código], ...] */
    tabs: function (items, title) {
      return {
        type: 'tabs', title: title || '',
        tabs: items.map(function (t) { return { label: t[0], lang: t[1], code: t[2] }; })
      };
    },
    /** Aviso. kind: tip | warn | kmp | new | info */
    note: function (kind, title, md) { return { type: 'note', kind: kind, title: title, md: md }; },
    list: function (items) { return { type: 'list', items: items }; },
    steps: function (items) { return { type: 'steps', items: items }; },
    table: function (head, rows) { return { type: 'table', head: head, rows: rows }; },
    /** Ideas clave (resumen al final de la lección). */
    keys: function (items) { return { type: 'keys', items: items }; },
    /** Diagrama integrado: arquitectura | flujo | puente */
    diagram: function (name, caption) { return { type: 'diagram', name: name, caption: caption || '' }; },
    /** Pregunta de test: answer es el índice (0-based) de la opción correcta. */
    q: function (question, options, answer, why) { return { q: question, options: options, answer: answer, why: why }; },
    /** Etiqueta para código: S`...` conserva las barras invertidas (\(interpolación) de Swift). */
    S: String.raw
  };
})(typeof window !== 'undefined' ? window : globalThis);
