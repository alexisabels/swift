/*
 * SwiftUI sobre KMP — aplicación: router por hash, vistas e interacción.
 * Script clásico sin dependencias (funciona abriendo index.html directamente).
 *
 * Rutas: #inicio · #m-<módulo> · #l-<lección> · #arquitectura · #interop[-<id>]
 *        #retos · #reto-<id> · #checklist · #glosario
 */
(function () {
  'use strict';

  var C = window.Curso;
  var store = window.CursoStore;
  var HL = window.Highlight;
  var DG = window.Diagrams;

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
  function plain(s) {
    return String(s || '').replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }

  /** Normaliza enlaces internos: "#/l/x" → "#l-x", "#/m/x" → "#m-x", "#/retos" → "#retos". */
  function normHref(url) {
    var m = /^#\/?(l|m)\/([a-z0-9-]+)$/.exec(url);
    if (m) return '#' + m[1] + '-' + m[2];
    if (/^#\//.test(url)) return '#' + url.slice(2);
    return url;
  }

  /** Markdown en línea: `código`, **negrita**, *cursiva*, [texto](url). Todo lo demás se escapa. */
  function md(s) {
    if (!s) return '';
    var codes = [];
    var out = String(s).replace(/`([^`]+)`/g, function (_, c) {
      codes.push(c);
      return '\u0000' + (codes.length - 1) + '\u0000';
    });
    out = esc(out);
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, text, url) {
      var href = normHref(url.replace(/&amp;/g, '&'));
      var external = /^https?:/.test(href);
      return '<a href="' + esc(href) + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + text + '</a>';
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<em>$2</em>');
    out = out.replace(/\u0000(\d+)\u0000/g, function (_, i) { return '<code>' + esc(codes[+i]) + '</code>'; });
    return out;
  }

  /** Igual que md() pero sin enlaces: para texto que va dentro de otro <a>. */
  function mdInline(s) { return md(String(s || '').replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')); }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // ---------------------------------------------------------------------------
  // Iconos (trazos propios, 24×24)
  // ---------------------------------------------------------------------------
  var ICONS = {
    swift: '<path d="M8 6l-6 6 6 6"/><path d="M16 6l6 6-6 6"/><path d="M13.5 4l-3 16"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><path d="M9 21V9"/>',
    bridge: '<path d="M2 18h20"/><path d="M4 18v-6"/><path d="M20 18v-6"/><path d="M2 12c4 0 6-5 10-5s6 5 10 5"/><path d="M9 18v-7.5"/><path d="M15 18v-7.5"/>',
    flask: '<path d="M9 3h6"/><path d="M10 3v6.5L4.6 18.2A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.8L14 9.5V3"/><path d="M7.5 15h9"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.8 8.2l-2.3 5.3-5.3 2.3 2.3-5.3z"/>',
    wrench: '<path d="M14.5 6.5a4.5 4.5 0 0 0 5.9 5.9L13 19.8a2.1 2.1 0 0 1-3-3l7.4-7.4"/><path d="M14.5 6.5L17 4l3 3-2.5 2.5"/><path d="M3 21l4-4"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M7 7l10 10"/><path d="M17 7L7 17"/>',
    arrowRight: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
    swap: '<path d="M4 8h13"/><path d="M14 4l4 4-4 4"/><path d="M20 16H7"/><path d="M10 12l-4 4 4 4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    listCheck: '<path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="M3 6l1.5 1.5L7 5"/><path d="M3 12l1.5 1.5L7 11"/><path d="M3 18l1.5 1.5L7 17"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5"/>',
    tip: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    warn: '<path d="M12 3l9.5 17H2.5z"/><path d="M12 10v4"/><path d="M12 17.5v.5"/>',
    kmp: '<path d="M4 4h16L4 20h16"/>',
    new: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.5"/>',
    reset: '<path d="M4 4v6h6"/><path d="M4.5 15a8 8 0 1 0 1.9-8.3L4 10"/>'
  };
  function icon(name, cls) {
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
  }

  // ---------------------------------------------------------------------------
  // Índices de contenido
  // ---------------------------------------------------------------------------
  var modules = C.modules.slice().sort(function (a, b) { return a.order - b.order; });
  var lessons = [];
  var lessonById = {};
  var moduleById = {};
  modules.forEach(function (m) {
    moduleById[m.id] = m;
    m.lessons.forEach(function (l, i) {
      var entry = Object.assign({}, l, { module: m, indexInModule: i, index: lessons.length });
      lessons.push(entry);
      lessonById[l.id] = entry;
    });
  });
  var allLessonIds = lessons.map(function (l) { return l.id; });
  var totalMinutes = lessons.reduce(function (a, l) { return a + (l.minutes || 0); }, 0);
  var totalQuestions = lessons.reduce(function (a, l) { return a + (l.quiz ? l.quiz.length : 0); }, 0);

  function challengeSlug(id) { return String(id).replace(/^reto-/, ''); }
  function challengeHref(c) { return '#reto-' + challengeSlug(c.id); }
  function findChallenge(slug) {
    for (var i = 0; i < C.challenges.length; i++) {
      if (challengeSlug(C.challenges[i].id) === slug) return C.challenges[i];
    }
    return null;
  }

  var LANG_LABEL = { swift: 'Swift', kotlin: 'Kotlin', gradle: 'Gradle KTS', bash: 'Terminal', text: 'Texto', json: 'JSON' };

  // ---------------------------------------------------------------------------
  // Bloques de código
  // ---------------------------------------------------------------------------
  var codeRegistry = {};
  var codeSeq = 0;

  function codeBlock(lang, src, title, opts) {
    opts = opts || {};
    var code = C.dedent(src);
    var id = 'c' + (++codeSeq);
    codeRegistry[id] = code;
    var lines = HL.lines(code, lang);
    var chipCls = (lang === 'kotlin' || lang === 'gradle') ? 'kotlin' : (lang === 'swift' ? 'swift' : 'neutral');
    return (
      '<figure class="code" data-lang="' + esc(lang) + '">' +
      '<figcaption class="code-head">' +
      '<span class="lang-chip lang-' + chipCls + '">' + esc(LANG_LABEL[lang] || lang) + '</span>' +
      (title ? '<span class="code-title">' + esc(title) + '</span>' : '<span class="code-title"></span>') +
      '<button type="button" class="code-copy" data-action="copy" data-code="' + id + '" aria-label="Copiar código">' + icon('copy') + '<span>Copiar</span></button>' +
      '</figcaption>' +
      '<pre class="code-body' + (opts.compact ? ' is-compact' : '') + '"><code>' + lines.join('\n') + '</code></pre>' +
      '</figure>'
    );
  }

  // ---------------------------------------------------------------------------
  // Bloques de lección
  // ---------------------------------------------------------------------------
  var NOTE_META = {
    tip: { label: 'Consejo', icon: 'tip' },
    warn: { label: 'Cuidado', icon: 'warn' },
    kmp: { label: 'En KMP', icon: 'kmp' },
    new: { label: 'Novedad', icon: 'new' },
    info: { label: 'Contexto', icon: 'info' }
  };

  function renderBlock(b, ctx) {
    switch (b.type) {
      case 'p':
        return '<p>' + md(b.md) + '</p>';
      case 'h': {
        var id = 'sec-' + (ctx.sections.length + 1);
        ctx.sections.push({ id: id, title: plain(b.md) });
        return '<h2 id="' + id + '" class="sec-title">' + md(b.md) + '</h2>';
      }
      case 'code':
        return codeBlock(b.lang, b.code, b.title);
      case 'compare':
        return (
          '<div class="compare">' +
          '<div class="cmp cmp-bad"><div class="cmp-label">' + icon('x') + '<span>' + esc(b.badTitle || 'Evita') + '</span></div>' +
          codeBlock(b.lang, b.bad) + (b.badNote ? '<p class="cmp-note">' + md(b.badNote) + '</p>' : '') + '</div>' +
          '<div class="cmp cmp-good"><div class="cmp-label">' + icon('check') + '<span>' + esc(b.goodTitle || 'Mejor así') + '</span></div>' +
          codeBlock(b.lang, b.good) + (b.goodNote ? '<p class="cmp-note">' + md(b.goodNote) + '</p>' : '') + '</div>' +
          '</div>'
        );
      case 'tabs': {
        var gid = 'tabs' + (++codeSeq);
        var head = b.tabs.map(function (t, i) {
          var side = (t.lang === 'kotlin' || t.lang === 'gradle') ? 'kotlin' : (t.lang === 'swift' ? 'swift' : 'neutral');
          return '<button type="button" role="tab" class="tab tab-' + side + '" id="' + gid + '-t' + i + '" aria-controls="' + gid + '-p' + i + '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '" data-action="tab" data-i="' + i + '">' + esc(t.label) + '</button>';
        }).join('');
        var panels = b.tabs.map(function (t, i) {
          return '<div role="tabpanel" id="' + gid + '-p' + i + '" aria-labelledby="' + gid + '-t' + i + '"' + (i === 0 ? '' : ' hidden') + '>' + codeBlock(t.lang, t.code) + '</div>';
        }).join('');
        return '<div class="tabs">' + (b.title ? '<p class="tabs-title">' + md(b.title) + '</p>' : '') + '<div class="tab-list" role="tablist">' + head + '</div>' + panels + '</div>';
      }
      case 'note': {
        var meta = NOTE_META[b.kind] || NOTE_META.info;
        return (
          '<aside class="note note-' + esc(b.kind) + '">' +
          '<div class="note-head">' + icon(meta.icon) + '<span class="note-kind">' + meta.label + '</span><strong class="note-title">' + md(b.title) + '</strong></div>' +
          '<p>' + md(b.md) + '</p></aside>'
        );
      }
      case 'list':
        return '<ul class="list">' + b.items.map(function (it) { return '<li>' + md(it) + '</li>'; }).join('') + '</ul>';
      case 'steps':
        return '<ol class="steps">' + b.items.map(function (it) { return '<li>' + md(it) + '</li>'; }).join('') + '</ol>';
      case 'table':
        return (
          '<div class="table-wrap"><table><thead><tr>' +
          b.head.map(function (h) { return '<th scope="col">' + md(h) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
          b.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + md(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
          '</tbody></table></div>'
        );
      case 'keys':
        return (
          '<section class="keys" aria-label="Ideas clave"><h3 class="keys-title">Ideas clave</h3><ul>' +
          b.items.map(function (it) { return '<li>' + icon('check') + '<span>' + md(it) + '</span></li>'; }).join('') +
          '</ul></section>'
        );
      case 'diagram':
        return diagramFigure(b.name, b.caption);
      default:
        return '';
    }
  }

  function diagramFigure(name, caption) {
    var defaults = {
      arquitectura: 'Naranja: lo que escribes en Swift. Violeta: lo que llega del módulo compartido. Explóralo en [Arquitectura interactiva](#arquitectura).',
      flujo: 'Las acciones bajan; los datos suben como streams y acaban en una única propiedad `state`.',
      puente: 'Tres maneras de que Swift vea tu Kotlin. Detalles en [SKIE, KMP-NativeCoroutines y Swift export](#l-puentes).'
    };
    return (
      '<figure class="diagram"><div class="diagram-scroll">' + DG.render(name) + '</div>' +
      '<figcaption>' + md(caption || defaults[name] || '') + '</figcaption></figure>'
    );
  }

  // ---------------------------------------------------------------------------
  // Shell: barra lateral, progreso, tema
  // ---------------------------------------------------------------------------
  var main = $('#main');
  var sidebar = $('#sidebar');
  var current = { view: 'home' };

  function progressInfo() {
    var done = store.doneCount(allLessonIds);
    return { done: done, total: allLessonIds.length, pct: allLessonIds.length ? Math.round((done / allLessonIds.length) * 100) : 0 };
  }

  function renderTopProgress() {
    var p = progressInfo();
    var el = $('#top-progress');
    if (!el) return;
    var r = 9, c = 2 * Math.PI * r;
    el.innerHTML =
      '<svg viewBox="0 0 24 24" class="ring" aria-hidden="true"><circle cx="12" cy="12" r="' + r + '" class="ring-bg"/>' +
      '<circle cx="12" cy="12" r="' + r + '" class="ring-fg" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (c * (1 - p.pct / 100)).toFixed(2) + '"/></svg>' +
      '<span>' + p.pct + '%</span>';
    el.setAttribute('aria-label', 'Progreso del curso: ' + p.done + ' de ' + p.total + ' lecciones');
    el.title = p.done + ' de ' + p.total + ' lecciones completadas';
  }

  function renderSidebar() {
    var activeModule = null;
    if (current.view === 'lesson' && lessonById[current.id]) activeModule = lessonById[current.id].module.id;
    if (current.view === 'module') activeModule = current.id;

    var html = '<div class="side-inner">';
    html += '<a class="side-link' + (current.view === 'home' ? ' is-active' : '') + '" href="#inicio">' + icon('home') + '<span>Inicio</span></a>';
    html += '<p class="side-label">Ruta de aprendizaje</p><ol class="side-modules">';
    modules.forEach(function (m) {
      var ids = m.lessons.map(function (l) { return l.id; });
      var done = store.doneCount(ids);
      var open = activeModule === m.id;
      html += '<li class="side-module' + (open ? ' is-open' : '') + (done === ids.length ? ' is-complete' : '') + '">';
      html += '<a class="side-mod-link' + (current.view === 'module' && current.id === m.id ? ' is-active' : '') + '" href="#m-' + m.id + '">' +
        '<span class="mod-num">' + m.order + '</span><span class="mod-name">' + esc(m.short) + '</span>' +
        '<span class="mod-count" aria-label="' + done + ' de ' + ids.length + ' completadas">' + done + '/' + ids.length + '</span></a>';
      if (open) {
        html += '<ol class="side-lessons">';
        m.lessons.forEach(function (l) {
          var active = current.view === 'lesson' && current.id === l.id;
          html += '<li><a class="side-lesson' + (active ? ' is-active' : '') + (store.isDone(l.id) ? ' is-done' : '') + '" href="#l-' + l.id + '"' + (active ? ' aria-current="page"' : '') + '>' +
            '<span class="dot" aria-hidden="true">' + (store.isDone(l.id) ? icon('check') : '') + '</span><span>' + esc(l.title) + '</span></a></li>';
        });
        html += '</ol>';
      }
      html += '</li>';
    });
    html += '</ol>';
    html += '<p class="side-label">Practica</p>';
    var tools = [
      ['architecture', '#arquitectura', 'map', 'Arquitectura interactiva'],
      ['interop', '#interop', 'swap', 'Kotlin → Swift'],
      ['challenges', '#retos', 'target', 'Retos de code review'],
      ['checklist', '#checklist', 'listCheck', 'Checklist de PR'],
      ['glossary', '#glosario', 'book', 'Glosario']
    ];
    tools.forEach(function (t) {
      var active = current.view === t[0] || (t[0] === 'challenges' && current.view === 'challenge');
      html += '<a class="side-link' + (active ? ' is-active' : '') + '" href="' + t[1] + '">' + icon(t[2]) + '<span>' + t[3] + '</span></a>';
    });
    html += '<p class="side-foot">Tu progreso se guarda solo en este navegador.</p>';
    html += '</div>';
    sidebar.innerHTML = html;
  }

  function applyTheme() {
    var t = store.theme();
    var root = document.documentElement;
    var btn = $('#theme-toggle');
    if (window.CURSO_EMBEDDED) { if (btn) btn.hidden = true; return; } // el visor decide el tema
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
    if (btn) {
      var name = t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'auto';
      var label = t === 'light' ? 'Tema claro' : t === 'dark' ? 'Tema oscuro' : 'Tema del sistema';
      btn.innerHTML = icon(name);
      btn.setAttribute('aria-label', label + ' (cambiar)');
      btn.title = label;
    }
  }

  // ---------------------------------------------------------------------------
  // Vistas
  // ---------------------------------------------------------------------------
  function viewHome() {
    var p = progressInfo();
    var lastId = store.last();
    var last = lastId && lessonById[lastId];
    var next = null;
    if (last) {
      next = store.isDone(last.id) ? (lessons[last.index + 1] || null) : last;
    }
    if (!next) {
      for (var i = 0; i < lessons.length; i++) { if (!store.isDone(lessons[i].id)) { next = lessons[i]; break; } }
    }
    var started = p.done > 0 || !!last;
    var cta = next
      ? '<a class="btn btn-primary" href="#l-' + next.id + '">' + (started ? 'Continuar: ' + esc(next.title) : 'Empezar por el módulo 1') + icon('arrowRight') + '</a>'
      : '<a class="btn btn-primary" href="#retos">Has terminado: ponte a prueba con los retos' + icon('arrowRight') + '</a>';

    var html = '<article class="page home">';
    html += '<header class="hero">';
    html += '<p class="eyebrow">Curso interactivo · Swift 6.4 · SwiftUI · Kotlin Multiplatform</p>';
    html += '<h1 tabindex="-1">SwiftUI arriba, <span class="k">Kotlin</span> debajo.</h1>';
    html += '<p class="lead">Aprende a escribir la app iOS con buenas prácticas de Swift y SwiftUI cuando los casos de uso, los repositorios y el acceso a datos viven en un módulo <strong>Kotlin Multiplatform</strong> compartido con Android.</p>';
    html += '<div class="hero-actions">' + cta + '<a class="btn" href="#arquitectura">' + icon('map') + 'Ver la arquitectura</a></div>';
    html += '<p class="hero-stats">' + plural(lessons.length, 'lección', 'lecciones') + ' · ' + (Math.round(totalMinutes / 6) / 10).toLocaleString('es-ES') + ' h de lectura · ' + plural(totalQuestions, 'pregunta', 'preguntas') + ' · ' + plural(C.challenges.length, 'reto', 'retos') + ' de code review</p>';
    if (p.done > 0) {
      html += '<div class="home-progress"><div class="bar"><span style="width:' + p.pct + '%"></span></div><span>' + p.done + ' de ' + p.total + ' lecciones completadas</span></div>';
    }
    html += '</header>';

    html += '<section class="home-map">' + diagramFigure('arquitectura', 'Tú escribes la mitad naranja. La mitad violeta llega como framework desde el módulo compartido. La frontera entre ambas es donde están casi todos los problemas, y casi todo este curso.') + '</section>';

    html += '<section class="home-section"><div class="section-head"><h2>Ruta de aprendizaje</h2><p>Siete módulos en orden. Cada lección termina con ideas clave y un test corto.</p></div><ol class="module-grid">';
    modules.forEach(function (m) {
      var ids = m.lessons.map(function (l) { return l.id; });
      var done = store.doneCount(ids);
      var pct = Math.round(done / ids.length * 100);
      var minutes = m.lessons.reduce(function (a, l) { return a + l.minutes; }, 0);
      html += '<li><a class="module-card mod-' + esc(m.icon) + '" href="#m-' + m.id + '">' +
        '<span class="mc-top"><span class="mc-num">Módulo ' + m.order + '</span>' + icon(m.icon, 'mc-icon') + '</span>' +
        '<span class="mc-title">' + esc(m.title) + '</span>' +
        '<span class="mc-desc">' + mdInline(m.description) + '</span>' +
        '<span class="mc-foot"><span>' + plural(ids.length, 'lección', 'lecciones') + ' · ' + minutes + ' min</span>' +
        '<span class="mc-bar" aria-label="' + done + ' de ' + ids.length + ' completadas"><span style="width:' + pct + '%"></span></span></span>' +
        '</a></li>';
    });
    html += '</ol></section>';

    html += '<section class="home-section"><div class="section-head"><h2>Practica lo aprendido</h2><p>Herramientas para volver una y otra vez mientras trabajas en el proyecto real.</p></div><div class="tool-grid">';
    var tools = [
      ['#arquitectura', 'map', 'Arquitectura interactiva', 'Qué hace cada capa, qué no debe hacer y un juego para decidir dónde va cada pieza.'],
      ['#interop', 'swap', 'Kotlin → Swift', 'Cómo llega cada construcción de Kotlin a Swift: export Obj-C, SKIE y Swift export.'],
      ['#retos', 'target', 'Retos de code review', 'Encuentra los fallos en código real antes de ver la solución.'],
      ['#checklist', 'listCheck', 'Checklist de PR', 'Lo que revisar antes de pedir review en una feature SwiftUI + KMP.'],
      ['#glosario', 'book', 'Glosario', 'Términos de Swift, SwiftUI y KMP con su equivalente en el otro lado.']
    ];
    tools.forEach(function (t) {
      html += '<a class="tool-card" href="' + t[0] + '">' + icon(t[1], 'tool-icon') + '<span class="tool-title">' + t[2] + '</span><span class="tool-desc">' + t[3] + '</span></a>';
    });
    html += '</div></section>';

    html += '<section class="home-section versions"><div class="section-head"><h2>Versiones que asume el curso</h2><p>Revisado en noviembre de 2026. Si tu proyecto va por detrás, casi todo aplica igual; donde no, la lección lo indica.</p></div>';
    html += '<div class="table-wrap"><table><thead><tr><th scope="col">Pieza</th><th scope="col">Versión</th><th scope="col">Por qué importa</th></tr></thead><tbody>' +
      '<tr><td>Swift / Xcode</td><td><code>Swift 6.4</code> · Xcode 27</td><td>Modo de lenguaje Swift 6 y Approachable Concurrency (desde 6.2). <code>@State</code> es una macro desde Xcode 27.</td></tr>' +
      '<tr><td>Despliegue iOS</td><td><code>iOS 17+</code></td><td>Mínimo para el framework Observation (<code>@Observable</code>).</td></tr>' +
      '<tr><td>Kotlin</td><td><code>2.4.x</code></td><td>Swift export pasa a Alpha en 2.4.0; sealed classes en Swift export desde 2.4.20.</td></tr>' +
      '<tr><td>Puente Kotlin → Swift</td><td>SKIE <code>0.10.x</code></td><td>La opción madura hoy. Comprueba siempre que tu versión de Kotlin está soportada.</td></tr>' +
      '<tr><td>CocoaPods</td><td>solo lectura desde el 2-12-2026</td><td>No empieces integraciones nuevas con CocoaPods.</td></tr>' +
      '</tbody></table></div></section>';

    html += '<footer class="home-foot"><p>Tu progreso (lecciones, tests, retos y checklist) se guarda solo en este navegador.</p>' +
      '<button type="button" class="btn btn-quiet" data-action="reset-all">' + icon('reset') + 'Borrar mi progreso</button></footer>';
    html += '</article>';
    return html;
  }

  function viewModule(id) {
    var m = moduleById[id];
    if (!m) return viewNotFound();
    var ids = m.lessons.map(function (l) { return l.id; });
    var done = store.doneCount(ids);
    var firstPending = m.lessons.filter(function (l) { return !store.isDone(l.id); })[0] || m.lessons[0];
    var minutes = m.lessons.reduce(function (a, l) { return a + l.minutes; }, 0);
    var html = '<article class="page module-page mod-' + esc(m.icon) + '">';
    html += '<header class="page-head">';
    html += '<p class="eyebrow">' + icon(m.icon) + 'Módulo ' + m.order + ' de ' + modules.length + '</p>';
    html += '<h1 tabindex="-1">' + esc(m.title) + '</h1>';
    html += '<p class="lead">' + md(m.description) + '</p>';
    html += '<div class="module-progress"><div class="bar"><span style="width:' + Math.round(done / ids.length * 100) + '%"></span></div>' +
      '<span>' + done + ' de ' + plural(ids.length, 'lección', 'lecciones') + ' · ' + minutes + ' min</span></div>';
    html += '<div class="hero-actions"><a class="btn btn-primary" href="#l-' + firstPending.id + '">' + (done === 0 ? 'Empezar el módulo' : done === ids.length ? 'Repasar desde el principio' : 'Continuar') + icon('arrowRight') + '</a></div>';
    html += '</header><ol class="lesson-list">';
    m.lessons.forEach(function (l, i) {
      var isDone = store.isDone(l.id);
      var quiz = store.quiz(l.id);
      html += '<li><a class="lesson-row' + (isDone ? ' is-done' : '') + '" href="#l-' + l.id + '">' +
        '<span class="lr-num" aria-hidden="true">' + (isDone ? icon('check') : (i + 1)) + '</span>' +
        '<span class="lr-main"><span class="lr-title">' + esc(l.title) + '</span><span class="lr-sum">' + mdInline(l.summary) + '</span></span>' +
        '<span class="lr-meta"><span class="chip">' + esc(l.level) + '</span><span>' + l.minutes + ' min</span>' +
        (quiz && quiz.done ? '<span class="lr-score">Test ' + quiz.score + '/' + quiz.total + '</span>' : '') + '</span>' +
        '</a></li>';
    });
    html += '</ol>';
    var prev = modules[modules.indexOf(m) - 1];
    var nextM = modules[modules.indexOf(m) + 1];
    html += '<nav class="pager" aria-label="Módulos">' +
      (prev ? '<a class="pager-link prev" href="#m-' + prev.id + '">' + icon('arrowLeft') + '<span><small>Módulo anterior</small><strong>' + esc(prev.title) + '</strong></span></a>' : '<span></span>') +
      (nextM ? '<a class="pager-link next" href="#m-' + nextM.id + '"><span><small>Siguiente módulo</small><strong>' + esc(nextM.title) + '</strong></span>' + icon('arrowRight') + '</a>' : '<span></span>') +
      '</nav>';
    html += '</article>';
    return html;
  }

  function viewLesson(id) {
    var l = lessonById[id];
    if (!l) return viewNotFound();
    store.setLast(l.id);
    var ctx = { sections: [] };
    var blocks = l.blocks.map(function (b) { return renderBlock(b, ctx); }).join('');
    var m = l.module;
    var prev = lessons[l.index - 1];
    var next = lessons[l.index + 1];
    var done = store.isDone(l.id);

    var html = '<div class="lesson-layout">';
    html += '<article class="page lesson mod-' + esc(m.icon) + '">';
    html += '<nav class="crumbs" aria-label="Ubicación"><a href="#m-' + m.id + '">' + icon(m.icon) + 'Módulo ' + m.order + ' · ' + esc(m.short) + '</a><span aria-hidden="true">/</span><span>Lección ' + (l.indexInModule + 1) + ' de ' + m.lessons.length + '</span></nav>';
    html += '<h1 tabindex="-1">' + esc(l.title) + '</h1>';
    html += '<div class="meta"><span class="chip chip-level">' + esc(l.level) + '</span><span class="chip">' + icon('clock') + l.minutes + ' min</span>' +
      (l.tags || []).slice(0, 6).map(function (t) { return '<span class="chip chip-tag">' + esc(t) + '</span>'; }).join('') +
      (done ? '<span class="chip chip-done">' + icon('check') + 'Completada</span>' : '') + '</div>';
    html += '<p class="lead">' + md(l.summary) + '</p>';
    html += '<div class="blocks">' + blocks + '</div>';
    html += '<div id="quiz-slot">' + quizHtml(l) + '</div>';
    html += '<div class="complete-row">' + completeButton(l) + '</div>';
    html += '<nav class="pager" aria-label="Lecciones">' +
      (prev ? '<a class="pager-link prev" href="#l-' + prev.id + '">' + icon('arrowLeft') + '<span><small>Anterior</small><strong>' + esc(prev.title) + '</strong></span></a>' : '<span></span>') +
      (next ? '<a class="pager-link next" href="#l-' + next.id + '"><span><small>' + (next.module !== m ? 'Siguiente módulo' : 'Siguiente') + '</small><strong>' + esc(next.title) + '</strong></span>' + icon('arrowRight') + '</a>' : '<a class="pager-link next" href="#retos"><span><small>Final del curso</small><strong>Ponte a prueba con los retos</strong></span>' + icon('arrowRight') + '</a>') +
      '</nav>';
    html += '</article>';

    // Índice lateral
    html += '<aside class="toc" aria-label="En esta lección"><div class="toc-inner"><p class="toc-label">En esta lección</p><ol>';
    ctx.sections.forEach(function (s) {
      html += '<li><button type="button" class="toc-link" data-action="scroll-to" data-target="' + s.id + '">' + esc(s.title) + '</button></li>';
    });
    html += '<li><button type="button" class="toc-link" data-action="scroll-to" data-target="quiz">Comprueba lo aprendido</button></li>';
    html += '</ol></div></aside>';
    html += '</div>';
    return html;
  }

  function completeButton(l) {
    var done = store.isDone(l.id);
    return '<button type="button" class="btn ' + (done ? 'btn-done' : 'btn-primary') + '" data-action="toggle-complete" data-id="' + l.id + '" aria-pressed="' + done + '">' +
      icon(done ? 'check' : 'check') + (done ? 'Completada · marcar como pendiente' : 'Marcar lección como completada') + '</button>';
  }

  // ---------------------------------------------------------------------------
  // Test de cada lección
  // ---------------------------------------------------------------------------
  var quizState = {}; // lessonId -> { answers: [] }

  function getQuizAnswers(l) {
    if (!quizState[l.id]) {
      var saved = store.quiz(l.id);
      quizState[l.id] = { answers: saved && Array.isArray(saved.answers) ? saved.answers.slice() : [] };
    }
    return quizState[l.id].answers;
  }

  function quizHtml(l) {
    var answers = getQuizAnswers(l);
    var quiz = l.quiz || [];
    var answered = quiz.filter(function (_, i) { return answers[i] != null; }).length;
    var correct = quiz.filter(function (q, i) { return answers[i] === q.answer; }).length;
    var html = '<section class="quiz" id="quiz" aria-labelledby="quiz-title">';
    html += '<div class="quiz-head"><h2 id="quiz-title">Comprueba lo aprendido</h2><span class="quiz-count">' + answered + '/' + quiz.length + ' respondidas</span></div>';
    html += '<ol class="quiz-list">';
    quiz.forEach(function (q, qi) {
      var a = answers[qi];
      var isAnswered = a != null;
      html += '<li class="qitem' + (isAnswered ? (a === q.answer ? ' is-right' : ' is-wrong') : '') + '">';
      html += '<p class="qtext">' + md(q.q) + '</p><div class="qopts">';
      q.options.forEach(function (o, oi) {
        var cls = 'qopt';
        if (isAnswered) {
          if (oi === q.answer) cls += ' is-answer';
          if (oi === a && a !== q.answer) cls += ' is-chosen-wrong';
          if (oi === a) cls += ' is-chosen';
        }
        html += '<button type="button" class="' + cls + '" data-action="quiz" data-lesson="' + l.id + '" data-q="' + qi + '" data-o="' + oi + '"' + (isAnswered ? ' disabled' : '') + '>' +
          '<span class="qletter" aria-hidden="true">' + String.fromCharCode(65 + oi) + '</span><span class="qlabel">' + md(o) + '</span>' +
          (isAnswered && oi === q.answer ? icon('check', 'qmark') : '') + (isAnswered && oi === a && a !== q.answer ? icon('x', 'qmark') : '') +
          '</button>';
      });
      html += '</div>';
      if (isAnswered) {
        html += '<div class="qwhy" role="status"><strong>' + (a === q.answer ? 'Correcto.' : 'No exactamente.') + '</strong> ' + md(q.why) + '</div>';
      }
      html += '</li>';
    });
    html += '</ol>';
    if (answered === quiz.length && quiz.length) {
      var msg = correct === quiz.length ? 'Perfecto: lo tienes.' : correct >= quiz.length / 2 ? 'Bien. Repasa las explicaciones de las que fallaste.' : 'Merece la pena releer la lección antes de seguir.';
      html += '<div class="quiz-result"><span class="qr-score">' + correct + '/' + quiz.length + '</span><span>' + msg + '</span>' +
        '<button type="button" class="btn btn-quiet" data-action="quiz-reset" data-lesson="' + l.id + '">' + icon('reset') + 'Repetir el test</button></div>';
    }
    html += '</section>';
    return html;
  }

  function answerQuiz(lessonId, qi, oi) {
    var l = lessonById[lessonId];
    if (!l) return;
    var answers = getQuizAnswers(l);
    if (answers[qi] != null) return;
    answers[qi] = oi;
    var total = l.quiz.length;
    var answered = l.quiz.filter(function (_, i) { return answers[i] != null; }).length;
    var score = l.quiz.filter(function (q, i) { return answers[i] === q.answer; }).length;
    store.setQuiz(l.id, { answers: answers.slice(), score: score, total: total, done: answered === total });
    var slot = $('#quiz-slot');
    if (slot) {
      slot.innerHTML = quizHtml(l);
      var items = $$('.qitem', slot);
      var btn = items[qi] && $('.qwhy', items[qi]);
      if (btn) btn.setAttribute('tabindex', '-1');
    }
    if (answered === total && score >= Math.ceil(total / 2) && !store.isDone(l.id)) {
      store.setDone(l.id, true);
      refreshCompletion(l);
      toast('Lección completada. Puedes desmarcarla cuando quieras.');
    }
  }

  function refreshCompletion(l) {
    var row = $('.complete-row');
    if (row) row.innerHTML = completeButton(l);
    var meta = $('.lesson .meta');
    if (meta) {
      var chip = $('.chip-done', meta);
      if (store.isDone(l.id) && !chip) meta.insertAdjacentHTML('beforeend', '<span class="chip chip-done">' + icon('check') + 'Completada</span>');
      if (!store.isDone(l.id) && chip) chip.remove();
    }
    renderSidebar();
    renderTopProgress();
  }

  // ---------------------------------------------------------------------------
  // Arquitectura interactiva
  // ---------------------------------------------------------------------------
  var archSelected = 'viewmodel';

  function archLayer(id) {
    var a = C.architecture;
    if (!a) return null;
    for (var i = 0; i < a.layers.length; i++) if (a.layers[i].id === id) return a.layers[i];
    return null;
  }

  function archDetailHtml() {
    var layer = archLayer(archSelected);
    if (!layer) return '<p>Selecciona una capa del diagrama.</p>';
    var side = layer.side === 'kotlin' ? 'kotlin' : 'swift';
    var html = '<div class="arch-card arch-' + side + '">';
    html += '<p class="eyebrow">' + (side === 'kotlin' ? 'Kotlin · módulo Shared' : 'Swift · app iOS') + '</p>';
    html += '<h2>' + esc(layer.name) + '</h2>';
    html += '<p>' + md(layer.role) + '</p>';
    html += '<div class="arch-cols"><div><h3>' + icon('check') + 'Se encarga de</h3><ul>' + (layer.does || []).map(function (d) { return '<li>' + md(d) + '</li>'; }).join('') + '</ul></div>';
    html += '<div><h3>' + icon('x') + 'No debería</h3><ul>' + (layer.avoid || []).map(function (d) { return '<li>' + md(d) + '</li>'; }).join('') + '</ul></div></div>';
    if (layer.code) html += codeBlock(layer.lang || 'swift', layer.code, layer.codeTitle || '');
    if (layer.lesson && lessonById[layer.lesson]) html += '<a class="text-link" href="#l-' + layer.lesson + '">Lección: ' + esc(lessonById[layer.lesson].title) + icon('arrowRight') + '</a>';
    html += '</div>';
    return html;
  }

  function gameHtml() {
    var a = C.architecture;
    if (!a || !a.game) return '';
    var answers = store.game();
    var answered = 0, right = 0;
    a.game.forEach(function (g, i) { if (answers[i]) { answered++; if (answers[i] === g.answer) right++; } });
    var html = '<section class="game" id="game" aria-labelledby="game-title">';
    html += '<div class="section-head"><h2 id="game-title">¿Dónde va esto?</h2><p>Para cada pieza de código, elige la capa en la que debería vivir. Acertar aquí evita la mitad de los comentarios de una code review.</p></div>';
    html += '<p class="game-score" role="status">' + right + ' aciertos de ' + answered + ' respondidas · ' + a.game.length + ' en total</p>';
    html += '<ol class="game-list">';
    a.game.forEach(function (g, i) {
      var chosen = answers[i];
      html += '<li class="game-item' + (chosen ? (chosen === g.answer ? ' is-right' : ' is-wrong') : '') + '"><p class="game-q">' + md(g.item) + '</p><div class="game-opts">';
      a.layers.forEach(function (layer) {
        var cls = 'game-opt game-' + (layer.side === 'kotlin' ? 'kotlin' : 'swift');
        if (chosen) {
          if (layer.id === g.answer) cls += ' is-answer';
          if (layer.id === chosen && chosen !== g.answer) cls += ' is-chosen-wrong';
        }
        html += '<button type="button" class="' + cls + '" data-action="game" data-i="' + i + '" data-layer="' + layer.id + '"' + (chosen ? ' disabled' : '') + '>' + esc(layer.short || layer.name) + '</button>';
      });
      html += '</div>';
      if (chosen) html += '<p class="game-why"><strong>' + (chosen === g.answer ? 'Bien.' : 'Va en «' + esc((archLayer(g.answer) || {}).name || g.answer) + '».') + '</strong> ' + md(g.why) + '</p>';
      html += '</li>';
    });
    html += '</ol>';
    if (answered) html += '<button type="button" class="btn btn-quiet" data-action="game-reset">' + icon('reset') + 'Volver a empezar</button>';
    html += '</section>';
    return html;
  }

  function viewArchitecture() {
    var html = '<article class="page wide arch-page">';
    html += '<header class="page-head"><p class="eyebrow">' + icon('map') + 'Herramienta</p><h1 tabindex="-1">Arquitectura interactiva</h1>' +
      '<p class="lead">Pulsa cada capa para ver su responsabilidad, lo que no debería hacer y un ejemplo. La regla de oro: las dependencias apuntan hacia abajo y Kotlin solo se toca en el adaptador.</p></header>';
    html += '<div class="arch-grid"><figure class="diagram arch-diagram"><div class="diagram-scroll" id="arch-svg">' + DG.render('arquitectura', { interactive: true, selected: archSelected }) + '</div>' +
      '<figcaption>Naranja: Swift (app iOS). Violeta: Kotlin (módulo Shared).</figcaption></figure>';
    html += '<section class="arch-detail" id="arch-detail" aria-live="polite">' + archDetailHtml() + '</section></div>';
    html += gameHtml();
    html += '</article>';
    return html;
  }

  function selectArchLayer(id) {
    archSelected = id;
    var svgHost = $('#arch-svg');
    if (svgHost) svgHost.innerHTML = DG.render('arquitectura', { interactive: true, selected: id });
    var detail = $('#arch-detail');
    if (detail) detail.innerHTML = archDetailHtml();
    var focusTarget = svgHost && $('[data-layer="' + id + '"]', svgHost);
    if (focusTarget && document.activeElement && document.activeElement.closest && document.activeElement.closest('#arch-svg')) focusTarget.focus();
  }

  // ---------------------------------------------------------------------------
  // Interop Kotlin → Swift
  // ---------------------------------------------------------------------------
  function viewInterop(id) {
    var items = C.interopItems;
    if (!items.length) return viewNotFound();
    var item = items.filter(function (it) { return it.id === id; })[0] || items[0];
    var html = '<article class="page wide interop-page">';
    html += '<header class="page-head"><p class="eyebrow">' + icon('swap') + 'Herramienta</p><h1 tabindex="-1">Kotlin → Swift</h1>' +
      '<p class="lead">Elige una construcción de Kotlin y mira cómo la recibe tu código Swift con el export Obj-C por defecto, con SKIE y con Swift export. Así sabrás qué pedirle al equipo KMP y qué resolver en tu adaptador.</p></header>';
    html += '<div class="interop-layout"><nav class="interop-nav" aria-label="Construcciones de Kotlin"><ul>';
    items.forEach(function (it) {
      html += '<li><a class="interop-item' + (it.id === item.id ? ' is-active' : '') + '" href="#interop-' + it.id + '"' + (it.id === item.id ? ' aria-current="true"' : '') + '>' + mdInline(it.title) + '</a></li>';
    });
    html += '</ul></nav><section class="interop-detail" aria-live="polite">';
    html += '<h2>' + md(item.title) + '</h2>';
    if (item.summary) html += '<p class="lead">' + md(item.summary) + '</p>';
    html += '<div class="io-block io-kotlin"><h3><span class="lang-dot kotlin"></span>Kotlin · módulo shared</h3>' + codeBlock('kotlin', item.kotlin) + '</div>';
    html += '<div class="io-pair">';
    html += '<div class="io-block"><h3><span class="lang-dot swift"></span>Swift · export Obj-C (por defecto)</h3>' + codeBlock('swift', item.objc) + '<p class="io-note">' + md(item.objcNote) + '</p></div>';
    html += '<div class="io-block"><h3><span class="lang-dot swift"></span>Swift · con SKIE</h3>' + codeBlock('swift', item.skie) + '<p class="io-note">' + md(item.skieNote) + '</p></div>';
    html += '</div>';
    html += renderBlock({ type: 'note', kind: 'new', title: 'Swift export (Alpha en Kotlin 2.4.x)', md: item.swiftExport }, { sections: [] });
    html += renderBlock({ type: 'note', kind: 'tip', title: 'Qué hacer en tu proyecto', md: item.advice }, { sections: [] });
    if (item.lesson && lessonById[item.lesson]) html += '<a class="text-link" href="#l-' + item.lesson + '">Lección relacionada: ' + esc(lessonById[item.lesson].title) + icon('arrowRight') + '</a>';
    html += '</section></div></article>';
    return html;
  }

  // ---------------------------------------------------------------------------
  // Retos de code review
  // ---------------------------------------------------------------------------
  var challengeState = {}; // id -> { selected: {line:true}, checked: bool, showFixed: bool }

  function viewChallenges() {
    var html = '<article class="page wide challenges-page">';
    html += '<header class="page-head"><p class="eyebrow">' + icon('target') + 'Herramienta</p><h1 tabindex="-1">Retos de code review</h1>' +
      '<p class="lead">Código que podría llegarte en una pull request. Marca las líneas que cambiarías, comprueba y compara con la versión corregida.</p></header>';
    html += '<div class="challenge-grid">';
    C.challenges.forEach(function (c) {
      var best = store.challenge(c.id);
      html += '<a class="challenge-card" href="' + challengeHref(c) + '">' +
        '<span class="cc-top"><span class="chip">' + esc(c.topic) + '</span><span class="chip chip-level">' + esc(c.level) + '</span>' +
        '<span class="lang-chip lang-' + ((c.lang === 'kotlin' || c.lang === 'gradle') ? 'kotlin' : 'swift') + '">' + esc(LANG_LABEL[c.lang] || c.lang) + '</span></span>' +
        '<span class="cc-title">' + esc(c.title) + '</span><span class="cc-intro">' + mdInline(c.intro) + '</span>' +
        '<span class="cc-foot">' + plural(c.issues.length, 'problema', 'problemas') + (best ? ' · tu mejor resultado: ' + best.found + '/' + best.total : '') + '</span></a>';
    });
    html += '</div></article>';
    return html;
  }

  function getChallengeState(c) {
    if (!challengeState[c.id]) challengeState[c.id] = { selected: {}, checked: false };
    return challengeState[c.id];
  }

  function issueOfLine(c, n) {
    for (var i = 0; i < c.issues.length; i++) if (c.issues[i].lines.indexOf(n) !== -1) return i;
    return -1;
  }

  function challengeBodyHtml(c) {
    var st = getChallengeState(c);
    var code = C.dedent(c.code);
    var lines = HL.lines(code, c.lang);
    var html = '<div class="cr-code code" data-lang="' + esc(c.lang) + '">';
    html += '<div class="code-head"><span class="lang-chip lang-' + ((c.lang === 'kotlin' || c.lang === 'gradle') ? 'kotlin' : 'swift') + '">' + esc(LANG_LABEL[c.lang] || c.lang) + '</span><span class="code-title">' +
      (st.checked ? 'Resultado' : 'Pulsa las líneas con problemas') + '</span></div><div class="cr-lines" role="group" aria-label="Líneas de código">';
    lines.forEach(function (lineHtml, i) {
      var n = i + 1;
      var sel = !!st.selected[n];
      var cls = 'cline';
      if (sel) cls += ' is-selected';
      var issueIdx = issueOfLine(c, n);
      var tag = '';
      if (st.checked) {
        if (issueIdx !== -1) {
          var found = c.issues[issueIdx].lines.some(function (ln) { return st.selected[ln]; });
          cls += found ? ' is-hit' : ' is-missed';
          tag = '<span class="cl-tag">' + (issueIdx + 1) + '</span>';
        } else if (sel) {
          cls += ' is-extra';
        }
      }
      html += '<button type="button" class="' + cls + '" data-action="line" data-id="' + esc(c.id) + '" data-line="' + n + '" aria-pressed="' + sel + '"' + (st.checked ? ' disabled' : '') + '>' +
        '<span class="cl-num">' + n + '</span><span class="cl-code">' + (lineHtml || ' ') + '</span>' + tag + '</button>';
    });
    html += '</div></div>';

    if (!st.checked) {
      var count = Object.keys(st.selected).length;
      html += '<div class="cr-actions"><button type="button" class="btn btn-primary" data-action="cr-check" data-id="' + esc(c.id) + '">' + icon('check') + 'Comprobar' + (count ? ' (' + plural(count, 'línea', 'líneas') + ')' : '') + '</button>' +
        (count ? '<button type="button" class="btn btn-quiet" data-action="cr-clear" data-id="' + esc(c.id) + '">Desmarcar todo</button>' : '') + '</div>';
      return html;
    }

    var foundCount = 0;
    var issuesHtml = c.issues.map(function (iss, i) {
      var found = iss.lines.some(function (ln) { return st.selected[ln]; });
      if (found) foundCount++;
      return '<li class="cr-issue ' + (found ? 'is-found' : 'is-missed') + '"><span class="cr-num">' + (i + 1) + '</span><div><p class="cr-issue-title">' +
        icon(found ? 'check' : 'x') + '<strong>' + md(iss.title) + '</strong><span class="cr-lines-ref">' + (iss.lines.length > 1 ? 'líneas ' : 'línea ') + iss.lines.join(', ') + '</span></p><p>' + md(iss.why) + '</p></div></li>';
    }).join('');
    var extra = Object.keys(st.selected).filter(function (n) { return issueOfLine(c, +n) === -1; }).length;
    html += '<section class="cr-results" aria-live="polite"><p class="cr-score"><strong>' + foundCount + ' de ' + c.issues.length + '</strong> problemas encontrados' +
      (extra ? ' · ' + plural(extra, 'línea marcada', 'líneas marcadas') + ' sin problema' : '') + '</p>';
    html += '<ol class="cr-issues">' + issuesHtml + '</ol>';
    html += '<h3>Versión corregida</h3>' + codeBlock(c.lang, c.fixed, 'Propuesta') + (c.fixedNote ? '<p class="cmp-note">' + md(c.fixedNote) + '</p>' : '');
    html += '<div class="cr-actions"><button type="button" class="btn" data-action="cr-reset" data-id="' + esc(c.id) + '">' + icon('reset') + 'Intentarlo de nuevo</button></div></section>';
    return html;
  }

  function viewChallenge(slug) {
    var c = findChallenge(slug);
    if (!c) return viewNotFound();
    var idx = C.challenges.indexOf(c);
    var prev = C.challenges[idx - 1];
    var next = C.challenges[idx + 1];
    var html = '<article class="page challenge-page">';
    html += '<nav class="crumbs" aria-label="Ubicación"><a href="#retos">' + icon('target') + 'Retos</a><span aria-hidden="true">/</span><span>' + (idx + 1) + ' de ' + C.challenges.length + '</span></nav>';
    html += '<h1 tabindex="-1">' + esc(c.title) + '</h1>';
    html += '<div class="meta"><span class="chip">' + esc(c.topic) + '</span><span class="chip chip-level">' + esc(c.level) + '</span></div>';
    html += '<p class="lead">' + md(c.intro) + '</p>';
    html += '<p class="cr-hint">' + icon('target') + 'Hay <strong>' + plural(c.issues.length, 'problema', 'problemas') + '</strong>. Marca al menos una línea de cada uno.</p>';
    html += '<div id="cr-body">' + challengeBodyHtml(c) + '</div>';
    html += '<nav class="pager" aria-label="Retos">' +
      (prev ? '<a class="pager-link prev" href="' + challengeHref(prev) + '">' + icon('arrowLeft') + '<span><small>Reto anterior</small><strong>' + esc(prev.title) + '</strong></span></a>' : '<span></span>') +
      (next ? '<a class="pager-link next" href="' + challengeHref(next) + '"><span><small>Siguiente reto</small><strong>' + esc(next.title) + '</strong></span>' + icon('arrowRight') + '</a>' : '<a class="pager-link next" href="#checklist"><span><small>Para tu próxima PR</small><strong>Checklist de PR</strong></span>' + icon('arrowRight') + '</a>') +
      '</nav>';
    html += '</article>';
    return html;
  }

  function rerenderChallenge(c, focusLine) {
    var body = $('#cr-body');
    if (!body) return;
    body.innerHTML = challengeBodyHtml(c);
    if (focusLine) {
      var b = $('[data-line="' + focusLine + '"]', body);
      if (b) b.focus();
    }
  }

  // ---------------------------------------------------------------------------
  // Checklist
  // ---------------------------------------------------------------------------
  function checklistCounts() {
    var total = 0, done = 0;
    C.checklistGroups.forEach(function (g) { g.items.forEach(function (it) { total++; if (store.checked(it.id)) done++; }); });
    return { total: total, done: done };
  }

  function viewChecklist() {
    var counts = checklistCounts();
    var html = '<article class="page checklist-page">';
    html += '<header class="page-head"><p class="eyebrow">' + icon('listCheck') + 'Herramienta</p><h1 tabindex="-1">Checklist de PR</h1>' +
      '<p class="lead">Repásala antes de pedir revisión de una feature SwiftUI que consume el módulo KMP. Las marcas se guardan en este navegador; desmárcala para la siguiente PR.</p>';
    html += '<div class="ck-toolbar"><p class="ck-progress" id="ck-progress" role="status">' + counts.done + ' de ' + counts.total + ' revisados</p>' +
      '<button type="button" class="btn" data-action="ck-copy">' + icon('copy') + 'Copiar como Markdown</button>' +
      '<button type="button" class="btn btn-quiet" data-action="ck-clear">' + icon('reset') + 'Desmarcar todo</button></div></header>';
    C.checklistGroups.forEach(function (g, gi) {
      html += '<section class="ck-group"><h2>' + esc(g.group) + '</h2><ul class="ck-list">';
      g.items.forEach(function (it) {
        var id = 'ck-' + it.id;
        html += '<li class="ck-item"><input type="checkbox" id="' + esc(id) + '" data-ck="' + esc(it.id) + '"' + (store.checked(it.id) ? ' checked' : '') + '>' +
          '<div class="ck-body"><label for="' + esc(id) + '">' + md(it.text) + '</label>' +
          (it.why ? '<p class="ck-why">' + md(it.why) + (it.lesson && lessonById[it.lesson] ? ' <a href="#l-' + it.lesson + '">Ver lección</a>' : '') + '</p>' : '') + '</div></li>';
      });
      html += '</ul></section>';
    });
    html += '<textarea id="ck-md" class="visually-hidden" aria-hidden="true" tabindex="-1" readonly></textarea>';
    html += '</article>';
    return html;
  }

  function checklistMarkdown() {
    var out = ['## Checklist SwiftUI + KMP', ''];
    C.checklistGroups.forEach(function (g) {
      out.push('### ' + g.group);
      g.items.forEach(function (it) { out.push('- [' + (store.checked(it.id) ? 'x' : ' ') + '] ' + it.text); });
      out.push('');
    });
    return out.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Glosario
  // ---------------------------------------------------------------------------
  var glossaryFilter = { q: '', cat: 'Todas' };

  function viewGlossary() {
    var items = C.glossaryItems.slice().sort(function (a, b) { return norm(a.term).localeCompare(norm(b.term)); });
    var cats = ['Todas'];
    items.forEach(function (g) { if (cats.indexOf(g.category) === -1) cats.push(g.category); });
    var html = '<article class="page glossary-page">';
    html += '<header class="page-head"><p class="eyebrow">' + icon('book') + 'Herramienta</p><h1 tabindex="-1">Glosario</h1>' +
      '<p class="lead">Términos de Swift, SwiftUI y Kotlin Multiplatform. Cuando existe, verás el equivalente en el otro lenguaje.</p></header>';
    html += '<div class="gl-controls"><label class="visually-hidden" for="gl-q">Filtrar términos</label>' +
      '<div class="input-wrap">' + icon('search') + '<input type="search" id="gl-q" placeholder="Filtra: StateFlow, @MainActor, sealed…" value="' + esc(glossaryFilter.q) + '" autocomplete="off"></div>' +
      '<div class="chips-row" role="group" aria-label="Categorías">' +
      cats.map(function (c) { return '<button type="button" class="filter-chip' + (glossaryFilter.cat === c ? ' is-active' : '') + '" data-action="gl-cat" data-cat="' + esc(c) + '" aria-pressed="' + (glossaryFilter.cat === c) + '">' + esc(c) + '</button>'; }).join('') +
      '</div></div>';
    html += '<p class="gl-count" id="gl-count" role="status"></p><dl class="gl-list">';
    items.forEach(function (g) {
      var text = norm([g.term, plain(g.md), plain(g.kotlin), plain(g.swift)].join(' '));
      html += '<div class="gl-item" data-cat="' + esc(g.category) + '" data-text="' + esc(text) + '">' +
        '<dt><span class="gl-term">' + esc(g.term) + '</span><span class="chip">' + esc(g.category) + '</span></dt>' +
        '<dd><p>' + md(g.md) + '</p>';
      if (g.kotlin || g.swift) {
        html += '<p class="gl-eq">' + (g.kotlin ? '<span class="eq eq-kotlin"><span class="lang-dot kotlin"></span>Kotlin: ' + md(g.kotlin) + '</span>' : '') +
          (g.swift ? '<span class="eq eq-swift"><span class="lang-dot swift"></span>Swift: ' + md(g.swift) + '</span>' : '') + '</p>';
      }
      if (g.lesson && lessonById[g.lesson]) html += '<a class="text-link" href="#l-' + g.lesson + '">Lección: ' + esc(lessonById[g.lesson].title) + icon('arrowRight') + '</a>';
      html += '</dd></div>';
    });
    html += '</dl><p class="gl-empty" id="gl-empty" hidden>No hay términos que coincidan. Prueba con otra palabra o elige «Todas».</p></article>';
    return html;
  }

  function applyGlossaryFilter() {
    var q = norm(glossaryFilter.q).trim();
    var terms = q ? q.split(/\s+/) : [];
    var shown = 0;
    $$('.gl-item').forEach(function (el) {
      var okCat = glossaryFilter.cat === 'Todas' || el.getAttribute('data-cat') === glossaryFilter.cat;
      var text = el.getAttribute('data-text');
      var okText = terms.every(function (t) { return text.indexOf(t) !== -1; });
      el.hidden = !(okCat && okText);
      if (!el.hidden) shown++;
    });
    var count = $('#gl-count');
    if (count) count.textContent = plural(shown, 'término', 'términos');
    var empty = $('#gl-empty');
    if (empty) empty.hidden = shown !== 0;
  }

  function viewNotFound() {
    return '<article class="page"><header class="page-head"><h1 tabindex="-1">No encuentro esa página</h1>' +
      '<p class="lead">El enlace puede ser de una versión anterior del curso. Vuelve al inicio o usa el buscador.</p>' +
      '<div class="hero-actions"><a class="btn btn-primary" href="#inicio">' + icon('home') + 'Ir al inicio</a>' +
      '<button type="button" class="btn" data-action="search-open">' + icon('search') + 'Buscar</button></div></header></article>';
  }

  // ---------------------------------------------------------------------------
  // Router
  // ---------------------------------------------------------------------------
  function parseHash() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ''));
    var compat = /^\/?(l|m)\/([a-z0-9-]+)$/.exec(h);
    if (compat) h = compat[1] + '-' + compat[2];
    h = h.replace(/^\//, '');
    if (!h || h === 'inicio') return { view: 'home' };
    if (h.indexOf('l-') === 0) return { view: 'lesson', id: h.slice(2) };
    if (h.indexOf('m-') === 0) return { view: 'module', id: h.slice(2) };
    if (h === 'arquitectura') return { view: 'architecture' };
    if (h === 'interop') return { view: 'interop', id: null };
    if (h.indexOf('interop-') === 0) return { view: 'interop', id: h.slice(8) };
    if (h === 'retos') return { view: 'challenges' };
    if (h.indexOf('reto-') === 0) return { view: 'challenge', id: h.slice(5) };
    if (h === 'checklist') return { view: 'checklist' };
    if (h === 'glosario') return { view: 'glossary' };
    return { view: 'notfound' };
  }

  var TITLES = {
    home: 'Inicio', architecture: 'Arquitectura interactiva', interop: 'Kotlin → Swift', challenges: 'Retos de code review',
    checklist: 'Checklist de PR', glossary: 'Glosario', notfound: 'No encontrado'
  };

  function route() {
    var prev = current;
    current = parseHash();
    codeRegistry = {};
    var html;
    switch (current.view) {
      case 'home': html = viewHome(); break;
      case 'module': html = viewModule(current.id); break;
      case 'lesson': html = viewLesson(current.id); break;
      case 'architecture': html = viewArchitecture(); break;
      case 'interop': html = viewInterop(current.id); break;
      case 'challenges': html = viewChallenges(); break;
      case 'challenge': html = viewChallenge(current.id); break;
      case 'checklist': html = viewChecklist(); break;
      case 'glossary': html = viewGlossary(); break;
      default: html = viewNotFound();
    }
    main.innerHTML = html;
    renderSidebar();
    renderTopProgress();
    closeDrawer();

    var title = TITLES[current.view] || '';
    if (current.view === 'lesson' && lessonById[current.id]) title = lessonById[current.id].title;
    if (current.view === 'module' && moduleById[current.id]) title = moduleById[current.id].title;
    if (current.view === 'challenge') { var ch = findChallenge(current.id); if (ch) title = ch.title; }
    document.title = (current.view === 'home' ? '' : title + ' · ') + 'SwiftUI sobre KMP';

    if (current.view === 'glossary') applyGlossaryFilter();
    if (current.view === 'lesson') setupScrollSpy();

    // Solo el interop cambia de ítem sin mover el scroll de la página
    var sameInterop = prev.view === 'interop' && current.view === 'interop';
    if (!sameInterop) window.scrollTo(0, 0);
    if (prev.view !== current.view || prev.id !== current.id) {
      var h1 = $('h1', main);
      if (h1 && !sameInterop && routedOnce) h1.focus({ preventScroll: true });
    }
    routedOnce = true;
  }
  var routedOnce = false;

  // Resalta en el índice la sección visible
  var spy = null;
  function setupScrollSpy() {
    if (spy) { spy.disconnect(); spy = null; }
    if (!('IntersectionObserver' in window)) return;
    var targets = $$('.sec-title, #quiz', main);
    if (!targets.length) return;
    spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id;
        $$('.toc-link').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-target') === id); });
      });
    }, { rootMargin: '-15% 0px -70% 0px' });
    targets.forEach(function (t) { spy.observe(t); });
  }

  // ---------------------------------------------------------------------------
  // Búsqueda (paleta)
  // ---------------------------------------------------------------------------
  var searchIndex = null;

  function blockText(b) {
    switch (b.type) {
      case 'p': case 'h': return plain(b.md);
      case 'note': return plain(b.title) + ' ' + plain(b.md);
      case 'list': case 'steps': case 'keys': return b.items.map(plain).join(' ');
      case 'table': return b.head.map(plain).join(' ') + ' ' + b.rows.map(function (r) { return r.map(plain).join(' '); }).join(' ');
      case 'compare': return plain(b.badNote) + ' ' + plain(b.goodNote);
      default: return '';
    }
  }

  function buildIndex() {
    var idx = [];
    lessons.forEach(function (l) {
      var body = l.blocks.map(blockText).join(' ');
      idx.push({
        kind: 'Lección', href: '#l-' + l.id, title: l.title, sub: 'Módulo ' + l.module.order + ' · ' + l.module.short,
        t: norm(l.title), tags: norm((l.tags || []).join(' ')), s: norm(plain(l.summary)), b: norm(body), raw: plain(l.summary) + ' ' + body
      });
    });
    modules.forEach(function (m) {
      idx.push({ kind: 'Módulo', href: '#m-' + m.id, title: m.title, sub: plural(m.lessons.length, 'lección', 'lecciones'), t: norm(m.title + ' ' + m.short), tags: '', s: norm(plain(m.description)), b: '', raw: plain(m.description) });
    });
    C.glossaryItems.forEach(function (g) {
      idx.push({ kind: 'Glosario', href: '#glosario', title: g.term, sub: g.category, t: norm(g.term), tags: norm(plain(g.kotlin) + ' ' + plain(g.swift)), s: norm(plain(g.md)), b: '', raw: plain(g.md), gl: g.term });
    });
    C.interopItems.forEach(function (it) {
      idx.push({ kind: 'Kotlin → Swift', href: '#interop-' + it.id, title: plain(it.title), sub: 'Interop', t: norm(plain(it.title)), tags: '', s: norm(plain(it.summary || '')), b: norm(plain(it.advice) + ' ' + plain(it.objcNote) + ' ' + plain(it.skieNote)), raw: plain(it.summary || it.advice) });
    });
    C.challenges.forEach(function (c) {
      idx.push({ kind: 'Reto', href: challengeHref(c), title: c.title, sub: c.topic, t: norm(c.title), tags: norm(c.topic), s: norm(plain(c.intro)), b: norm(c.issues.map(function (i) { return plain(i.title) + ' ' + plain(i.why); }).join(' ')), raw: plain(c.intro) });
    });
    [
      ['#arquitectura', 'Arquitectura interactiva', 'capas vista viewmodel adaptador dominio datos composition root'],
      ['#interop', 'Kotlin → Swift', 'interop skie swift export objective-c'],
      ['#retos', 'Retos de code review', 'ejercicios practica'],
      ['#checklist', 'Checklist de PR', 'revision pull request'],
      ['#glosario', 'Glosario', 'terminos definiciones']
    ].forEach(function (t) {
      idx.push({ kind: 'Herramienta', href: t[0], title: t[1], sub: 'Herramienta', t: norm(t[1]), tags: norm(t[2]), s: '', b: '', raw: '' });
    });
    return idx;
  }

  function search(q) {
    if (!searchIndex) searchIndex = buildIndex();
    var terms = norm(q).trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    var res = [];
    searchIndex.forEach(function (e) {
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i], s = 0;
        if (e.t.indexOf(t) !== -1) s += e.t.indexOf(t) === 0 ? 12 : 8;
        if (e.tags.indexOf(t) !== -1) s += 5;
        if (e.s.indexOf(t) !== -1) s += 3;
        if (e.b.indexOf(t) !== -1) s += 1;
        if (!s) return;
        score += s;
      }
      res.push({ e: e, score: score + (e.kind === 'Lección' ? 1 : 0) });
    });
    res.sort(function (a, b) { return b.score - a.score; });
    return res.slice(0, 24).map(function (r) { return r.e; });
  }

  function snippet(e, q) {
    if (!e.raw) return '';
    var terms = norm(q).trim().split(/\s+/).filter(Boolean);
    var text = e.raw.replace(/\s+/g, ' ');
    var n = norm(text);
    var pos = -1;
    for (var i = 0; i < terms.length && pos === -1; i++) pos = n.indexOf(terms[i]);
    if (pos === -1) return esc(text.slice(0, 110)) + (text.length > 110 ? '…' : '');
    var start = Math.max(0, pos - 40);
    var piece = text.slice(start, start + 130);
    var html = esc(piece);
    terms.forEach(function (t) {
      if (t.length < 2) return;
      var np = norm(piece);
      var at = np.indexOf(t);
      if (at !== -1) {
        var original = piece.slice(at, at + t.length);
        html = html.replace(esc(original), '<mark>' + esc(original) + '</mark>');
      }
    });
    return (start > 0 ? '…' : '') + html + (start + 130 < text.length ? '…' : '');
  }

  var palette = $('#palette');
  var paletteInput = $('#palette-input');
  var paletteList = $('#palette-results');
  var paletteActive = 0;
  var paletteItems = [];
  var lastFocus = null;

  function openPalette() {
    lastFocus = document.activeElement;
    palette.hidden = false;
    document.body.classList.add('has-modal');
    paletteInput.value = '';
    renderPaletteResults();
    setTimeout(function () { paletteInput.focus(); }, 0);
  }
  function closePalette() {
    if (palette.hidden) return;
    palette.hidden = true;
    document.body.classList.remove('has-modal');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function renderPaletteResults() {
    var q = paletteInput.value;
    if (!q.trim()) {
      paletteItems = [];
      var sugg = ['@Observable', 'sealed', 'Flow', 'Sendable', '@Throws', '.task', 'SKIE', 'Swift export', 'previews', 'NavigationStack'];
      paletteList.innerHTML = '<li class="pal-empty"><p>Busca en lecciones, glosario, retos y la tabla Kotlin → Swift.</p><div class="chips-row">' +
        sugg.map(function (s) { return '<button type="button" class="filter-chip" data-action="pal-suggest" data-q="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div></li>';
      return;
    }
    paletteItems = search(q);
    paletteActive = 0;
    if (!paletteItems.length) {
      paletteList.innerHTML = '<li class="pal-empty"><p>Sin resultados para «' + esc(q) + '». Prueba con un término más corto.</p></li>';
      return;
    }
    paletteList.innerHTML = paletteItems.map(function (e, i) {
      return '<li role="option" id="pal-' + i + '" aria-selected="' + (i === 0) + '"><a class="pal-item' + (i === 0 ? ' is-active' : '') + '" href="' + esc(e.href) + '" data-i="' + i + '"' + (e.gl ? ' data-gl="' + esc(e.gl) + '"' : '') + '>' +
        '<span class="pal-kind">' + esc(e.kind) + '</span><span class="pal-main"><span class="pal-title">' + esc(e.title) + '</span>' +
        '<span class="pal-sub">' + esc(e.sub) + '</span><span class="pal-snip">' + snippet(e, q) + '</span></span></a></li>';
    }).join('');
    paletteInput.setAttribute('aria-activedescendant', 'pal-0');
  }
  function movePalette(delta) {
    if (!paletteItems.length) return;
    paletteActive = (paletteActive + delta + paletteItems.length) % paletteItems.length;
    $$('.pal-item', paletteList).forEach(function (a, i) {
      a.classList.toggle('is-active', i === paletteActive);
      a.parentNode.setAttribute('aria-selected', i === paletteActive);
      if (i === paletteActive) a.scrollIntoView({ block: 'nearest' });
    });
    paletteInput.setAttribute('aria-activedescendant', 'pal-' + paletteActive);
  }
  function goPalette(i) {
    var e = paletteItems[i];
    if (!e) return;
    if (e.gl) { glossaryFilter.q = e.gl; glossaryFilter.cat = 'Todas'; }
    closePalette();
    if (location.hash === e.href) route(); else location.hash = e.href;
  }

  // ---------------------------------------------------------------------------
  // Drawer (móvil) y toast
  // ---------------------------------------------------------------------------
  var scrim = $('#scrim');
  function openDrawer() {
    document.body.classList.add('drawer-open');
    scrim.hidden = false;
    $('#menu-toggle').setAttribute('aria-expanded', 'true');
    var first = $('a, button', sidebar);
    if (first) first.focus();
  }
  function closeDrawer() {
    if (!document.body.classList.contains('drawer-open')) return;
    document.body.classList.remove('drawer-open');
    scrim.hidden = true;
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
  }

  var toastTimer = null;
  function toast(text) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  function copyText(text, okMsg) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      toast(ok ? okMsg : 'No he podido copiar: selecciona el texto y cópialo a mano.');
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
        return;
      }
    } catch (e) { /* uso el plan B */ }
    fallback();
  }

  // ---------------------------------------------------------------------------
  // Eventos (delegados)
  // ---------------------------------------------------------------------------
  var resetArmed = null;

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-action]');
    if (!el) {
      // Enlaces dentro de la paleta
      var pal = ev.target.closest('.pal-item');
      if (pal) { ev.preventDefault(); goPalette(+pal.getAttribute('data-i')); }
      return;
    }
    var action = el.getAttribute('data-action');
    switch (action) {
      case 'copy': {
        var code = codeRegistry[el.getAttribute('data-code')];
        if (code != null) copyText(code, 'Código copiado');
        break;
      }
      case 'tab': {
        var tabs = el.closest('.tabs');
        var i = +el.getAttribute('data-i');
        $$('[role="tab"]', tabs).forEach(function (t, ti) {
          t.setAttribute('aria-selected', ti === i);
          t.setAttribute('tabindex', ti === i ? 0 : -1);
        });
        $$('[role="tabpanel"]', tabs).forEach(function (p, pi) { p.hidden = pi !== i; });
        break;
      }
      case 'quiz':
        answerQuiz(el.getAttribute('data-lesson'), +el.getAttribute('data-q'), +el.getAttribute('data-o'));
        break;
      case 'quiz-reset': {
        var lid = el.getAttribute('data-lesson');
        quizState[lid] = { answers: [] };
        store.clearQuiz(lid);
        $('#quiz-slot').innerHTML = quizHtml(lessonById[lid]);
        var firstOpt = $('#quiz-slot .qopt');
        if (firstOpt) firstOpt.focus();
        break;
      }
      case 'toggle-complete': {
        var l = lessonById[el.getAttribute('data-id')];
        if (!l) break;
        var nowDone = !store.isDone(l.id);
        store.setDone(l.id, nowDone);
        refreshCompletion(l);
        var btn = $('.complete-row .btn');
        if (btn) btn.focus();
        toast(nowDone ? 'Lección completada' : 'Lección marcada como pendiente');
        break;
      }
      case 'scroll-to': {
        var target = document.getElementById(el.getAttribute('data-target'));
        if (target) {
          var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
        break;
      }
      case 'arch-layer':
        selectArchLayer(el.getAttribute('data-layer'));
        break;
      case 'game': {
        store.setGameAnswer(el.getAttribute('data-i'), el.getAttribute('data-layer'));
        var gi = +el.getAttribute('data-i');
        var game = $('#game');
        if (game) {
          game.outerHTML = gameHtml();
          var items = $$('.game-item');
          var why = items[gi] && $('.game-why', items[gi]);
          if (why) { why.setAttribute('tabindex', '-1'); why.focus({ preventScroll: true }); }
        }
        break;
      }
      case 'game-reset': {
        store.clearGame();
        var g = $('#game');
        if (g) g.outerHTML = gameHtml();
        break;
      }
      case 'line': {
        var c = findChallenge(challengeSlug(el.getAttribute('data-id')));
        if (!c) break;
        var st = getChallengeState(c);
        var n = +el.getAttribute('data-line');
        if (st.selected[n]) delete st.selected[n]; else st.selected[n] = true;
        rerenderChallenge(c, n);
        break;
      }
      case 'cr-check': {
        var c2 = findChallenge(challengeSlug(el.getAttribute('data-id')));
        if (!c2) break;
        var st2 = getChallengeState(c2);
        st2.checked = true;
        var found = c2.issues.filter(function (iss) { return iss.lines.some(function (ln) { return st2.selected[ln]; }); }).length;
        var prevBest = store.challenge(c2.id);
        if (!prevBest || found > prevBest.found) store.setChallenge(c2.id, { found: found, total: c2.issues.length });
        rerenderChallenge(c2);
        var res = $('.cr-results');
        if (res) { res.setAttribute('tabindex', '-1'); res.focus({ preventScroll: false }); }
        break;
      }
      case 'cr-clear':
      case 'cr-reset': {
        var c3 = findChallenge(challengeSlug(el.getAttribute('data-id')));
        if (!c3) break;
        challengeState[c3.id] = { selected: {}, checked: false };
        rerenderChallenge(c3);
        var firstLine = $('#cr-body .cline');
        if (firstLine) firstLine.focus();
        break;
      }
      case 'ck-copy':
        copyText(checklistMarkdown(), 'Checklist copiada como Markdown');
        break;
      case 'ck-clear':
        store.clearChecklist();
        $$('[data-ck]').forEach(function (cb) { cb.checked = false; });
        updateChecklistProgress();
        toast('Checklist desmarcada');
        break;
      case 'gl-cat':
        glossaryFilter.cat = el.getAttribute('data-cat');
        $$('.filter-chip[data-action="gl-cat"]').forEach(function (b) {
          var on = b.getAttribute('data-cat') === glossaryFilter.cat;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on);
        });
        applyGlossaryFilter();
        break;
      case 'search-open':
        openPalette();
        break;
      case 'pal-suggest':
        paletteInput.value = el.getAttribute('data-q');
        renderPaletteResults();
        paletteInput.focus();
        break;
      case 'pal-close':
        closePalette();
        break;
      case 'menu':
        if (document.body.classList.contains('drawer-open')) closeDrawer(); else openDrawer();
        break;
      case 'theme': {
        var order = [null, 'light', 'dark'];
        var cur = store.theme() || null;
        var nextTheme = order[(order.indexOf(cur) + 1) % order.length];
        store.setTheme(nextTheme);
        applyTheme();
        toast(nextTheme === 'light' ? 'Tema claro' : nextTheme === 'dark' ? 'Tema oscuro' : 'Tema del sistema');
        break;
      }
      case 'skip': {
        var h1 = $('h1', main);
        (h1 || main).focus();
        break;
      }
      case 'reset-all': {
        if (resetArmed) {
          clearTimeout(resetArmed);
          resetArmed = null;
          store.resetAll();
          quizState = {};
          challengeState = {};
          route();
          toast('Progreso borrado');
        } else {
          el.innerHTML = icon('reset') + 'Pulsa otra vez para confirmar';
          el.classList.add('is-armed');
          resetArmed = setTimeout(function () {
            resetArmed = null;
            el.innerHTML = icon('reset') + 'Borrar mi progreso';
            el.classList.remove('is-armed');
          }, 4000);
        }
        break;
      }
      default:
        break;
    }
  });

  // Teclado en elementos SVG con role=button y en pestañas
  document.addEventListener('keydown', function (ev) {
    var t = ev.target;
    if (t && t.getAttribute && t.getAttribute('data-action') === 'arch-layer' && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      selectArchLayer(t.getAttribute('data-layer'));
      return;
    }
    if (t && t.getAttribute && t.getAttribute('role') === 'tab' && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
      var list = $$('[role="tab"]', t.parentNode);
      var i = list.indexOf(t);
      var next = list[(i + (ev.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
      next.click();
      next.focus();
      ev.preventDefault();
      return;
    }
    var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if ((ev.key === 'k' || ev.key === 'K') && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); if (palette.hidden) openPalette(); else closePalette(); return; }
    if (ev.key === '/' && !typing && palette.hidden) { ev.preventDefault(); openPalette(); return; }
    if (ev.key === 'Escape') {
      if (!palette.hidden) { closePalette(); return; }
      if (document.body.classList.contains('drawer-open')) { closeDrawer(); $('#menu-toggle').focus(); }
    }
  });

  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t && t.hasAttribute && t.hasAttribute('data-ck')) {
      store.setChecked(t.getAttribute('data-ck'), t.checked);
      updateChecklistProgress();
    }
  });

  document.addEventListener('input', function (ev) {
    if (ev.target && ev.target.id === 'gl-q') {
      glossaryFilter.q = ev.target.value;
      applyGlossaryFilter();
    }
  });

  function updateChecklistProgress() {
    var p = $('#ck-progress');
    if (!p) return;
    var counts = checklistCounts();
    p.textContent = counts.done + ' de ' + counts.total + ' revisados';
  }

  // Paleta de búsqueda
  paletteInput.addEventListener('input', renderPaletteResults);
  paletteInput.addEventListener('keydown', function (ev) {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); movePalette(1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); movePalette(-1); }
    else if (ev.key === 'Enter') { ev.preventDefault(); goPalette(paletteActive); }
  });
  palette.addEventListener('click', function (ev) {
    if (ev.target === palette) closePalette();
  });
  scrim.addEventListener('click', closeDrawer);

  // Al pasar de móvil a escritorio, cerrar el cajón
  if (window.matchMedia) {
    var mq = window.matchMedia('(min-width: 960px)');
    var onMq = function () { if (mq.matches) closeDrawer(); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }

  window.addEventListener('hashchange', route);
  applyTheme();
  route();
})();
