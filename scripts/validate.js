#!/usr/bin/env node
/*
 * Valida el contenido del curso sin navegador:
 *   node scripts/validate.js
 *
 * Carga assets/js/curso.js y todos los ficheros de assets/content/ en un
 * contexto aislado y comprueba estructura, ids, enlaces internos, tests y retos.
 * Sale con código 1 si hay errores.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const contentDir = path.join(root, 'assets', 'content');
const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`✗ ${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`! ${where}: ${msg}`);

// ---------------------------------------------------------------------------
// 1. Carga en un contexto aislado (sin window.name ni otros globals del navegador)
// ---------------------------------------------------------------------------
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);

function load(file) {
  const src = fs.readFileSync(file, 'utf8');
  try {
    vm.runInContext(src, ctx, { filename: path.relative(root, file) });
  } catch (e) {
    err(path.relative(root, file), `no se puede ejecutar: ${e.message}`);
  }
  return src;
}

load(path.join(root, 'assets', 'js', 'curso.js'));
const contentFiles = fs.existsSync(contentDir)
  ? fs.readdirSync(contentDir).filter((f) => f.endsWith('.js')).sort()
  : [];

for (const f of contentFiles) {
  const full = path.join(contentDir, f);
  const src = load(full);
  // Los ficheros de contenido nunca deberían interpolar JS: un ${...} en un
  // bloque Kotlin se "come" el texto en el navegador.
  src.split('\n').forEach((line, i) => {
    if (line.includes('${')) err(`assets/content/${f}:${i + 1}`, 'contiene "${" (usa "$nombre" en Kotlin o reescribe la línea)');
  });
}

// index.html debe cargar todos los ficheros de contenido
const indexPath = path.join(root, 'index.html');
if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, 'utf8');
  for (const f of contentFiles) {
    if (!html.includes(`assets/content/${f}`)) err('index.html', `no carga assets/content/${f}`);
  }
}

const C = ctx.Curso;
if (!C) {
  console.error('No se ha podido cargar Curso.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Utilidades
// ---------------------------------------------------------------------------
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const lessonIds = new Set();
const moduleIds = new Set();
const allMd = []; // [where, md]

function checkMd(where, md) {
  if (md == null || md === '') return;
  if (typeof md !== 'string') return err(where, 'el texto debe ser un string');
  allMd.push([where, md]);
  const ticks = (md.match(/`/g) || []).length;
  if (ticks % 2 !== 0) warn(where, 'número impar de backticks (`) en el texto');
  const bolds = (md.match(/\*\*/g) || []).length;
  if (bolds % 2 !== 0) warn(where, 'número impar de ** en el texto');
}

function checkCode(where, lang, code) {
  if (!C.LANGS.includes(lang)) err(where, `lenguaje "${lang}" no soportado (${C.LANGS.join(', ')})`);
  if (!isStr(code)) return err(where, 'bloque de código vacío');
  const lines = C.dedent(code).split('\n');
  if (lines.length > 80) warn(where, `bloque de código muy largo (${lines.length} líneas)`);
  if (lines.some((l) => l.includes('\t'))) warn(where, 'el código contiene tabuladores (usa espacios)');
}

function checkBlock(where, b) {
  if (!b || typeof b !== 'object') return err(where, 'bloque inválido');
  switch (b.type) {
    case 'p':
    case 'h':
      if (!isStr(b.md)) err(where, `bloque ${b.type} vacío`);
      checkMd(where, b.md);
      break;
    case 'code':
      checkCode(where, b.lang, b.code);
      break;
    case 'compare':
      checkCode(`${where} (mal)`, b.lang, b.bad);
      checkCode(`${where} (bien)`, b.lang, b.good);
      checkMd(where, b.badNote);
      checkMd(where, b.goodNote);
      break;
    case 'tabs':
      if (!Array.isArray(b.tabs) || b.tabs.length < 2) err(where, 'tabs necesita al menos 2 pestañas');
      (b.tabs || []).forEach((t, i) => {
        if (!isStr(t.label)) err(`${where} tab ${i}`, 'pestaña sin etiqueta');
        checkCode(`${where} tab ${i}`, t.lang, t.code);
      });
      break;
    case 'note':
      if (!C.NOTE_KINDS.includes(b.kind)) err(where, `tipo de nota "${b.kind}" inválido (${C.NOTE_KINDS.join(', ')})`);
      if (!isStr(b.title)) err(where, 'nota sin título');
      if (!isStr(b.md)) err(where, 'nota sin texto');
      checkMd(where, b.title);
      checkMd(where, b.md);
      break;
    case 'list':
    case 'steps':
    case 'keys':
      if (!Array.isArray(b.items) || b.items.length === 0) err(where, `${b.type} sin elementos`);
      (b.items || []).forEach((it, i) => {
        if (!isStr(it)) err(`${where} item ${i}`, 'elemento vacío');
        checkMd(`${where} item ${i}`, it);
      });
      break;
    case 'table':
      if (!Array.isArray(b.head) || b.head.length < 2) err(where, 'tabla sin cabecera');
      (b.rows || []).forEach((r, i) => {
        if (!Array.isArray(r) || r.length !== b.head.length) err(`${where} fila ${i}`, `la fila debe tener ${b.head.length} celdas`);
        (r || []).forEach((c, j) => checkMd(`${where} fila ${i} col ${j}`, c));
      });
      break;
    case 'diagram':
      if (!C.DIAGRAMS.includes(b.name)) err(where, `diagrama "${b.name}" no existe (${C.DIAGRAMS.join(', ')})`);
      break;
    default:
      err(where, `tipo de bloque desconocido "${b.type}"`);
  }
}

function checkQuiz(where, quiz) {
  if (!Array.isArray(quiz) || quiz.length < 2) return err(where, 'la lección necesita un test con al menos 2 preguntas');
  quiz.forEach((item, i) => {
    const w = `${where} pregunta ${i + 1}`;
    if (!isStr(item.q)) err(w, 'pregunta vacía');
    if (!Array.isArray(item.options) || item.options.length < 2) err(w, 'necesita al menos 2 opciones');
    if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= (item.options || []).length) err(w, `answer=${item.answer} fuera de rango`);
    if (!isStr(item.why)) err(w, 'falta la explicación (why)');
    checkMd(w, item.q);
    checkMd(w, item.why);
    (item.options || []).forEach((o, j) => {
      if (!isStr(o)) err(`${w} opción ${j}`, 'opción vacía');
      checkMd(`${w} opción ${j}`, o);
    });
  });
}

// ---------------------------------------------------------------------------
// 3. Módulos y lecciones
// ---------------------------------------------------------------------------
const orders = new Set();
let lessonCount = 0;
let quizCount = 0;
let minutes = 0;

C.modules.forEach((m, mi) => {
  const w = `módulo ${m.id || mi}`;
  if (!isStr(m.id)) err(w, 'sin id');
  if (moduleIds.has(m.id)) err(w, 'id de módulo duplicado');
  moduleIds.add(m.id);
  if (!Number.isInteger(m.order)) err(w, 'order debe ser entero');
  if (orders.has(m.order)) err(w, `order ${m.order} duplicado`);
  orders.add(m.order);
  ['title', 'short', 'description'].forEach((k) => { if (!isStr(m[k])) err(w, `falta ${k}`); });
  if (!C.ICONS.includes(m.icon)) err(w, `icono "${m.icon}" no existe (${C.ICONS.join(', ')})`);
  if (!Array.isArray(m.lessons) || m.lessons.length === 0) err(w, 'sin lecciones');

  (m.lessons || []).forEach((l, li) => {
    const lw = `${m.id}/${l.id || li}`;
    lessonCount++;
    if (!isStr(l.id)) err(lw, 'lección sin id');
    if (!/^[a-z0-9-]+$/.test(l.id || '')) err(lw, 'el id solo puede tener a-z, 0-9 y guiones');
    if (lessonIds.has(l.id)) err(lw, 'id de lección duplicado');
    lessonIds.add(l.id);
    if (!isStr(l.title)) err(lw, 'sin título');
    if (!isStr(l.summary)) err(lw, 'sin summary');
    if (!Number.isFinite(l.minutes) || l.minutes <= 0) err(lw, 'minutes debe ser un número > 0');
    minutes += l.minutes || 0;
    if (!C.LEVELS.includes(l.level)) err(lw, `level "${l.level}" inválido (${C.LEVELS.join(', ')})`);
    if (!Array.isArray(l.tags)) err(lw, 'tags debe ser un array');
    if (!Array.isArray(l.blocks) || l.blocks.length < 3) err(lw, 'la lección necesita al menos 3 bloques');
    (l.blocks || []).forEach((b, bi) => checkBlock(`${lw} bloque ${bi + 1} (${b && b.type})`, b));
    if (!(l.blocks || []).some((b) => b && b.type === 'keys')) warn(lw, 'no tiene bloque keys (ideas clave)');
    checkQuiz(lw, l.quiz);
    quizCount += (l.quiz || []).length;
  });
});

// ---------------------------------------------------------------------------
// 4. Retos, glosario, checklist, interop, arquitectura
// ---------------------------------------------------------------------------
const challengeIds = new Set();
C.challenges.forEach((c, i) => {
  const w = `reto ${c.id || i}`;
  if (!isStr(c.id)) err(w, 'sin id');
  if (challengeIds.has(c.id)) err(w, 'id duplicado');
  challengeIds.add(c.id);
  ['title', 'intro', 'topic'].forEach((k) => { if (!isStr(c[k])) err(w, `falta ${k}`); });
  if (!C.LEVELS.includes(c.level)) err(w, `level "${c.level}" inválido`);
  checkMd(w, c.intro);
  checkCode(w, c.lang, c.code);
  checkCode(`${w} (solución)`, c.lang, c.fixed);
  checkMd(w, c.fixedNote);
  const n = C.dedent(c.code).split('\n').length;
  if (!Array.isArray(c.issues) || c.issues.length < 2) err(w, 'necesita al menos 2 issues');
  const seen = new Set();
  (c.issues || []).forEach((iss, j) => {
    const iw = `${w} issue ${j + 1}`;
    if (!Array.isArray(iss.lines) || iss.lines.length === 0) err(iw, 'sin líneas');
    (iss.lines || []).forEach((ln) => {
      if (!Number.isInteger(ln) || ln < 1 || ln > n) err(iw, `línea ${ln} fuera de rango (el código tiene ${n} líneas)`);
      if (seen.has(ln)) warn(iw, `la línea ${ln} pertenece a más de un issue`);
      seen.add(ln);
    });
    if (!isStr(iss.title)) err(iw, 'sin título');
    if (!isStr(iss.why)) err(iw, 'sin explicación');
    checkMd(iw, iss.title);
    checkMd(iw, iss.why);
  });
});

const terms = new Set();
C.glossaryItems.forEach((g, i) => {
  const w = `glosario ${g.term || i}`;
  if (!isStr(g.term)) err(w, 'sin término');
  if (terms.has((g.term || '').toLowerCase())) err(w, 'término duplicado');
  terms.add((g.term || '').toLowerCase());
  if (!isStr(g.md)) err(w, 'sin definición');
  if (!isStr(g.category)) err(w, 'sin categoría');
  checkMd(w, g.md);
  checkMd(w, g.kotlin);
  checkMd(w, g.swift);
  if (g.lesson && !lessonIds.has(g.lesson)) err(w, `lesson "${g.lesson}" no existe`);
});

const checkIds = new Set();
C.checklistGroups.forEach((g, i) => {
  const w = `checklist ${g.group || i}`;
  if (!isStr(g.group)) err(w, 'grupo sin nombre');
  (g.items || []).forEach((it, j) => {
    const iw = `${w} item ${it.id || j}`;
    if (!isStr(it.id)) err(iw, 'sin id');
    if (checkIds.has(it.id)) err(iw, 'id duplicado');
    checkIds.add(it.id);
    if (!isStr(it.text)) err(iw, 'sin texto');
    checkMd(iw, it.text);
    checkMd(iw, it.why);
    if (it.lesson && !lessonIds.has(it.lesson)) err(iw, `lesson "${it.lesson}" no existe`);
  });
});

const interopIds = new Set();
C.interopItems.forEach((it, i) => {
  const w = `interop ${it.id || i}`;
  if (!isStr(it.id)) err(w, 'sin id');
  if (interopIds.has(it.id)) err(w, 'id duplicado');
  interopIds.add(it.id);
  if (!isStr(it.title)) err(w, 'sin título');
  checkCode(`${w} kotlin`, 'kotlin', it.kotlin);
  checkCode(`${w} objc`, 'swift', it.objc);
  checkCode(`${w} skie`, 'swift', it.skie);
  ['objcNote', 'skieNote', 'swiftExport', 'advice'].forEach((k) => {
    if (!isStr(it[k])) err(w, `falta ${k}`);
    checkMd(w, it[k]);
  });
  if (it.lesson && !lessonIds.has(it.lesson)) err(w, `lesson "${it.lesson}" no existe`);
});

if (C.architecture) {
  const a = C.architecture;
  const layerIds = new Set((a.layers || []).map((l) => l.id));
  (a.layers || []).forEach((l) => {
    const w = `arquitectura ${l.id}`;
    ['id', 'name', 'side', 'role'].forEach((k) => { if (!isStr(l[k])) err(w, `falta ${k}`); });
    checkMd(w, l.role);
    (l.does || []).forEach((d) => checkMd(w, d));
    (l.avoid || []).forEach((d) => checkMd(w, d));
    if (l.code) checkCode(w, l.lang || 'swift', l.code);
    if (l.lesson && !lessonIds.has(l.lesson)) err(w, `lesson "${l.lesson}" no existe`);
  });
  (a.game || []).forEach((g, i) => {
    const w = `arquitectura juego ${i + 1}`;
    if (!isStr(g.item)) err(w, 'sin enunciado');
    if (!layerIds.has(g.answer)) err(w, `answer "${g.answer}" no es una capa`);
    checkMd(w, g.item);
    checkMd(w, g.why);
  });
}

// Enlaces internos dentro del texto: [texto](#/l/id) y (#/m/id)
for (const [where, md] of allMd) {
  const re = /\]\(#\/(l|m)\/([a-z0-9-]+)\)/g;
  let m;
  while ((m = re.exec(md))) {
    const set = m[1] === 'l' ? lessonIds : moduleIds;
    if (!set.has(m[2])) err(where, `enlace interno roto: #/${m[1]}/${m[2]}`);
  }
}

// ---------------------------------------------------------------------------
// 5. Resultado
// ---------------------------------------------------------------------------
warnings.forEach((w) => console.warn(w));
errors.forEach((e) => console.error(e));
console.log(
  `\n${C.modules.length} módulos · ${lessonCount} lecciones · ${quizCount} preguntas · ` +
  `${Math.round(minutes)} min · ${C.challenges.length} retos · ${C.glossaryItems.length} términos · ` +
  `${checkIds.size} ítems de checklist · ${C.interopItems.length} construcciones interop`
);
if (errors.length) {
  console.error(`\n${errors.length} error(es), ${warnings.length} aviso(s).`);
  process.exit(1);
}
console.log(`OK · ${warnings.length} aviso(s).`);
