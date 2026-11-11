/*
 * Diagramas SVG integrados. Los colores salen de variables CSS (temas claro/oscuro).
 * Naranja = lado Swift (lo escribes tú). Violeta = lado Kotlin (módulo compartido).
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var MARKERS =
    '<defs>' +
    '<marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
    '<path d="M0 0L10 5L0 10z" class="dg-head"/></marker>' +
    '<marker id="dg-arrow-k" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
    '<path d="M0 0L10 5L0 10z" class="dg-head-k"/></marker>' +
    '<marker id="dg-arrow-s" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
    '<path d="M0 0L10 5L0 10z" class="dg-head-s"/></marker>' +
    '</defs>';

  function node(opts) {
    // opts: x, y, w, h, title, sub, side ('swift'|'kotlin'|'neutral'), id, interactive, selected
    var cls = 'dg-node dg-' + opts.side + (opts.selected ? ' is-selected' : '') + (opts.interactive ? ' is-interactive' : '');
    var attrs = opts.interactive
      ? ' role="button" tabindex="0" data-action="arch-layer" data-layer="' + esc(opts.id) + '" aria-pressed="' + (opts.selected ? 'true' : 'false') + '" aria-label="' + esc(opts.title) + '"'
      : '';
    var cx = opts.x + 16;
    var titleY = opts.sub ? opts.y + opts.h / 2 - 4 : opts.y + opts.h / 2 + 5;
    return (
      '<g class="' + cls + '"' + attrs + '>' +
      '<rect x="' + opts.x + '" y="' + opts.y + '" width="' + opts.w + '" height="' + opts.h + '" rx="10"/>' +
      '<text class="dg-title" x="' + cx + '" y="' + titleY + '">' + esc(opts.title) + '</text>' +
      (opts.sub ? '<text class="dg-sub" x="' + cx + '" y="' + (opts.y + opts.h / 2 + 14) + '">' + esc(opts.sub) + '</text>' : '') +
      '</g>'
    );
  }

  function centered(opts) {
    var cls = 'dg-node dg-' + opts.side;
    var cx = opts.x + opts.w / 2;
    return (
      '<g class="' + cls + '">' +
      '<rect x="' + opts.x + '" y="' + opts.y + '" width="' + opts.w + '" height="' + opts.h + '" rx="10"/>' +
      '<text class="dg-title" text-anchor="middle" x="' + cx + '" y="' + (opts.sub ? opts.y + opts.h / 2 - 3 : opts.y + opts.h / 2 + 5) + '">' + esc(opts.title) + '</text>' +
      (opts.sub ? '<text class="dg-sub" text-anchor="middle" x="' + cx + '" y="' + (opts.y + opts.h / 2 + 14) + '">' + esc(opts.sub) + '</text>' : '') +
      '</g>'
    );
  }

  function label(x, y, text, cls, anchor) {
    return '<text class="' + (cls || 'dg-label') + '" x="' + x + '" y="' + y + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + esc(text) + '</text>';
  }

  // ---------------------------------------------------------------------------
  // Arquitectura por capas
  // ---------------------------------------------------------------------------
  var ARCH_NODES = [
    { id: 'view', x: 30, y: 58, w: 300, h: 52, side: 'swift', title: 'Vista SwiftUI', sub: 'pinta el estado · envía intenciones' },
    { id: 'viewmodel', x: 30, y: 134, w: 300, h: 52, side: 'swift', title: 'ViewModel', sub: '@MainActor @Observable · estado' },
    { id: 'adapter', x: 30, y: 210, w: 300, h: 52, side: 'swift', title: 'Adaptador', sub: 'protocolos · structs Sendable · errores' },
    { id: 'root', x: 390, y: 58, w: 300, h: 52, side: 'swift', title: 'Composition root', sub: 'crea las dependencias una sola vez' },
    { id: 'platform', x: 390, y: 210, w: 300, h: 52, side: 'swift', title: 'Servicios de plataforma', sub: 'Keychain, analítica… (Swift)' },
    { id: 'domain', x: 30, y: 366, w: 300, h: 52, side: 'kotlin', title: 'Dominio', sub: 'casos de uso · entidades · errores' },
    { id: 'data', x: 30, y: 442, w: 300, h: 52, side: 'kotlin', title: 'Datos', sub: 'repositorios · Ktor · SQLDelight / Room' }
  ];

  function architecture(opts) {
    opts = opts || {};
    var interactive = !!opts.interactive;
    var selected = opts.selected || null;
    var s = '<svg class="dg dg-arch" viewBox="0 0 720 520" role="' + (interactive ? 'group' : 'img') + '" aria-label="Arquitectura: la app iOS en Swift encima del módulo Shared de Kotlin Multiplatform">';
    s += MARKERS;
    // Zonas
    s += '<rect class="dg-zone dg-zone-swift" x="10" y="10" width="700" height="268" rx="16"/>';
    s += '<text class="dg-zone-title dg-zone-title-swift" x="30" y="40">App iOS<tspan class="dg-zone-sub" dx="8">Swift · SwiftUI · lo escribes tú</tspan></text>';
    s += '<rect class="dg-zone dg-zone-kotlin" x="10" y="318" width="700" height="192" rx="16"/>';
    s += '<text class="dg-zone-title dg-zone-title-kotlin" x="30" y="348">Shared<tspan class="dg-zone-sub" dx="8">Kotlin Multiplatform</tspan></text>';

    // Aristas lado Swift
    s += '<path class="dg-edge dg-edge-s" d="M180 110 V132" marker-end="url(#dg-arrow-s)"/>';
    s += '<path class="dg-edge dg-edge-s" d="M180 186 V208" marker-end="url(#dg-arrow-s)"/>';
    s += '<path class="dg-edge dg-edge-dash" d="M390 84 H360 V236 H334" marker-end="url(#dg-arrow)"/>';
    s += '<path class="dg-edge dg-edge-dash" d="M360 160 H334" marker-end="url(#dg-arrow)"/>';
    s += label(366, 150, 'inyecta', 'dg-label dg-label-small');
    // Cruce de frontera
    s += '<path class="dg-edge dg-edge-cross" d="M290 262 V364" marker-end="url(#dg-arrow-k)"/>';
    s += label(302, 298, 'invoca casos de uso', 'dg-label');
    s += label(302, 314, 'async · AsyncSequence', 'dg-label dg-label-small');
    s += '<path class="dg-edge dg-edge-dash" d="M540 262 V398" marker-end="url(#dg-arrow-k)"/>';
    s += label(552, 298, 'implementa', 'dg-label');
    // Lado Kotlin
    s += '<path class="dg-edge dg-edge-k" d="M180 418 V440" marker-end="url(#dg-arrow-k)"/>';
    s += centered({ x: 390, y: 400, w: 300, h: 52, side: 'kotlin-soft', title: 'Interfaces de plataforma', sub: 'p. ej. interface TokenStorage' });

    ARCH_NODES.forEach(function (n) {
      s += node({
        x: n.x, y: n.y, w: n.w, h: n.h, side: n.side, title: n.title, sub: n.sub, id: n.id,
        interactive: interactive, selected: selected === n.id
      });
    });
    s += '</svg>';
    return s;
  }

  // ---------------------------------------------------------------------------
  // Flujo de datos unidireccional
  // ---------------------------------------------------------------------------
  function flow() {
    var names = [
      ['Vista', 'SwiftUI', 'swift'],
      ['ViewModel', '@Observable', 'swift'],
      ['Adaptador', 'Swift', 'swift'],
      ['Caso de uso', 'Kotlin', 'kotlin'],
      ['Repositorio', 'Kotlin', 'kotlin']
    ];
    var top = ['toca «Actualizar»', 'await refresh()', 'invoke() suspend', 'red + base de datos'];
    var bottom = ['re-render', 'state = .loaded', 'AsyncStream', 'Flow<List<Book>>'];
    var s = '<svg class="dg dg-flow" viewBox="0 0 800 236" role="img" aria-label="Flujo de datos: las acciones bajan de la vista al repositorio y los datos suben como streams hasta el estado de la vista">';
    s += MARKERS;
    var w = 116, h = 58, y = 86, step = 160;
    var cxs = names.map(function (_, i) { return 80 + i * step; });
    // Frontera
    s += '<line class="dg-boundary" x1="480" y1="14" x2="480" y2="222"/>';
    s += label(486, 24, 'framework Shared', 'dg-label dg-label-small');
    for (var i = 0; i < names.length - 1; i++) {
      var a = cxs[i], b = cxs[i + 1], mid = (a + b) / 2;
      var sideCls = i >= 2 ? 'k' : 's';
      s += '<path class="dg-edge dg-edge-' + sideCls + '" d="M' + (a + 22) + ' ' + y + ' Q' + mid + ' 34 ' + (b - 22) + ' ' + y + '" marker-end="url(#dg-arrow-' + sideCls + ')"/>';
      s += label(mid, 44, top[i], 'dg-label', 'middle');
      var backCls = i >= 3 ? 'k' : 's';
      s += '<path class="dg-edge dg-edge-' + backCls + ' dg-edge-back" d="M' + (b - 22) + ' ' + (y + h) + ' Q' + mid + ' ' + (y + h + 52) + ' ' + (a + 22) + ' ' + (y + h) + '" marker-end="url(#dg-arrow-' + backCls + ')"/>';
      s += label(mid, y + h + 50, bottom[i], 'dg-label', 'middle');
    }
    names.forEach(function (n, i) {
      s += centered({ x: cxs[i] - w / 2, y: y, w: w, h: h, side: n[2], title: n[0], sub: n[1] });
    });
    s += label(16, 226, 'acciones →  ·  ← datos', 'dg-label dg-label-small');
    s += '</svg>';
    return s;
  }

  // ---------------------------------------------------------------------------
  // Opciones de puente Kotlin → Swift
  // ---------------------------------------------------------------------------
  function bridge() {
    var lanes = [
      {
        title: 'Export Obj-C', sub: 'por defecto',
        boxes: [['Kotlin', 'kotlin', 90], ['Cabecera Obj-C', 'neutral', 150]],
        caption: 'Sin dependencias, pero sin enums Swift, sealed no exhaustivo, Flow inutilizable y async sin cancelación.'
      },
      {
        title: 'Obj-C + SKIE', sub: 'plugin de Touchlab',
        boxes: [['Kotlin', 'kotlin', 90], ['Cabecera Obj-C', 'neutral', 150], ['SKIE genera Swift', 'neutral-strong', 160]],
        caption: 'Enums y sealed exhaustivos, async con cancelación, Flow → AsyncSequence. Hoy, la opción más madura.'
      },
      {
        title: 'Swift export', sub: 'Alpha · Kotlin 2.4.x',
        boxes: [['Kotlin', 'kotlin', 90], ['Módulo Swift directo', 'neutral', 170]],
        caption: 'Sin Obj-C: suspend → async, Flow → AsyncSequence, sealed (2.4.20). Pruébalo en una rama, aún cambia.'
      }
    ];
    var s = '<svg class="dg dg-bridge" viewBox="0 0 800 300" role="img" aria-label="Tres formas de exponer Kotlin a Swift: export Objective-C, Objective-C con SKIE y Swift export">';
    s += MARKERS;
    lanes.forEach(function (lane, li) {
      var y = 12 + li * 96;
      s += '<rect class="dg-lane" x="6" y="' + (y - 4) + '" width="788" height="90" rx="12"/>';
      s += '<text class="dg-lane-title" x="20" y="' + (y + 24) + '">' + esc(lane.title) + '</text>';
      s += '<text class="dg-lane-sub" x="20" y="' + (y + 42) + '">' + esc(lane.sub) + '</text>';
      var x = 186;
      lane.boxes.forEach(function (b, bi) {
        s += centered({ x: x, y: y + 6, w: b[2], h: 40, side: b[1], title: b[0] });
        x += b[2];
        if (bi < lane.boxes.length - 1) {
          s += '<path class="dg-edge" d="M' + (x + 2) + ' ' + (y + 26) + ' H' + (x + 26) + '" marker-end="url(#dg-arrow)"/>';
          x += 30;
        }
      });
      // Flecha final hasta Swift
      s += '<path class="dg-edge dg-edge-s" d="M' + (x + 2) + ' ' + (y + 26) + ' H' + 682 + '" marker-end="url(#dg-arrow-s)"/>';
      s += centered({ x: 686, y: y + 6, w: 96, h: 40, side: 'swift', title: 'Tu Swift' });
      s += '<text class="dg-caption" x="186" y="' + (y + 72) + '">' + esc(lane.caption) + '</text>';
    });
    s += '</svg>';
    return s;
  }

  global.Diagrams = {
    render: function (name, opts) {
      if (name === 'arquitectura') return architecture(opts);
      if (name === 'flujo') return flow();
      if (name === 'puente') return bridge();
      return '';
    },
    archNodes: ARCH_NODES
  };
})(window);
