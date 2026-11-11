/*
 * Resaltado de sintaxis mínimo para Swift, Kotlin (y Gradle KTS), Bash y JSON.
 * Devuelve un array de líneas en HTML para poder numerarlas (retos de code review).
 * Swift usa la paleta de Xcode; Kotlin, la de IntelliJ / Android Studio (ver CSS).
 */
(function (global) {
  'use strict';

  function words(s) { return new Set(s.split(/\s+/).filter(Boolean)); }

  var KEYWORDS = {
    swift: words(
      'actor any as associatedtype async await break case catch class continue convenience default defer deinit ' +
      'didSet do dynamic else enum extension fallthrough false fileprivate final for func get guard if import in ' +
      'indirect init inout internal is isolated lazy let mutating nil nonisolated nonmutating open operator ' +
      'override private protocol public repeat required rethrows return self Self set some static struct ' +
      'subscript super switch throw throws true try typealias unowned var weak where while willSet sending ' +
      'borrowing consuming package'
    ),
    kotlin: words(
      'abstract actual annotation as break by catch class companion const constructor continue crossinline data ' +
      'do else enum expect external false final finally for fun if import in infix init inline inner interface ' +
      'internal is lateinit noinline null object open operator out override package private protected public ' +
      'reified return sealed super suspend tailrec this throw true try typealias val var vararg when where while'
    ),
    bash: words('if then else elif fi for do done while case esac in function export cd echo set local return')
  };
  KEYWORDS.gradle = KEYWORDS.kotlin;

  // Palabras clave que, tras un punto, se siguen pintando como palabra clave.
  var DOT_KEYWORDS = words('init self Type Protocol');
  // Palabras de control que nunca son llamadas a función aunque vayan seguidas de "(".
  var CONTROL = words('if for while switch guard catch when return throw try await repeat in');

  var RE = {
    blockComment: /\/\*[\s\S]*?(\*\/|$)/y,
    lineComment: /\/\/[^\n]*/y,
    hashComment: /#[^\n]*/y,
    attribute: /@[A-Za-z_][\w]*(?::[A-Za-z_]\w*)?/y,
    directive: /#[A-Za-z_]\w*/y,
    number: /(?:0x[\da-fA-F_]+|0b[01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)[LuUfF]*/y,
    ident: /[A-Za-z_][\w]*/y,
    ws: /[ \t]+/y
  };

  function match(re, src, i) {
    re.lastIndex = i;
    var m = re.exec(src);
    return m ? m[0] : null;
  }

  function isWordChar(ch) { return !!ch && /[\w$]/.test(ch); }

  /** Escanea un string Swift/Kotlin desde i (sobre la comilla de apertura). */
  function scanString(src, i, lang, out) {
    var triple = src.startsWith('"""', i);
    var open = triple ? '"""' : '"';
    var j = i + open.length;
    var buf = open;
    function flush(cls) { if (buf) { out.push({ c: cls, t: buf }); buf = ''; } }

    while (j < src.length) {
      var ch = src[j];
      if (!triple && ch === '\n') break;
      if (ch === '\\') {
        if (lang === 'swift' && src[j + 1] === '(') {
          // Interpolación Swift: \( ... ) con paréntesis anidados
          buf += '\\(';
          flush('str');
          var depth = 1, k = j + 2;
          while (k < src.length && depth > 0) {
            if (src[k] === '(') depth++;
            else if (src[k] === ')') depth--;
            if (depth > 0) k++;
          }
          var inner = src.slice(j + 2, k);
          tokenize(inner, lang).forEach(function (t) { out.push(t.c ? t : { c: 'interp', t: t.t }); });
          if (k < src.length) out.push({ c: 'str', t: ')' });
          j = k + 1;
          continue;
        }
        buf += src.substr(j, 2);
        j += 2;
        continue;
      }
      if ((lang === 'kotlin' || lang === 'gradle') && ch === '$' && /[A-Za-z_]/.test(src[j + 1] || '')) {
        flush('str');
        var id = match(RE.ident, src, j + 1);
        out.push({ c: 'interp', t: '$' + id });
        j += 1 + id.length;
        continue;
      }
      if (triple && src.startsWith('"""', j)) {
        buf += '"""';
        j += 3;
        flush('str');
        return j;
      }
      if (!triple && ch === '"') {
        buf += '"';
        j += 1;
        flush('str');
        return j;
      }
      buf += ch;
      j++;
    }
    flush('str');
    return j;
  }

  function tokenize(src, lang) {
    var out = [];
    var kw = KEYWORDS[lang] || new Set();
    var cLike = lang === 'swift' || lang === 'kotlin' || lang === 'gradle';
    var i = 0;
    var prevSignificant = ''; // último token no-espacio (texto)
    var prevClass = '';

    function push(cls, text) {
      out.push({ c: cls, t: text });
      if (/\S/.test(text)) { prevSignificant = text; prevClass = cls; }
    }

    while (i < src.length) {
      var ch = src[i];
      var m;

      if (ch === '\n') { push('', '\n'); i++; continue; }
      if ((m = match(RE.ws, src, i))) { out.push({ c: '', t: m }); i += m.length; continue; }

      if (cLike && ch === '/' && src[i + 1] === '*') { m = match(RE.blockComment, src, i); push('com', m); i += m.length; continue; }
      if (cLike && ch === '/' && src[i + 1] === '/') { m = match(RE.lineComment, src, i); push('com', m); i += m.length; continue; }
      if (lang === 'bash' && ch === '#' && (i === 0 || /\s/.test(src[i - 1]))) { m = match(RE.hashComment, src, i); push('com', m); i += m.length; continue; }

      if (ch === '"') {
        if (lang === 'json') {
          var end = i + 1;
          while (end < src.length && src[end] !== '"' && src[end] !== '\n') { if (src[end] === '\\') end++; end++; }
          var str = src.slice(i, end + 1);
          var after = src.slice(end + 1).match(/^\s*:/);
          push(after ? 'prop' : 'str', str);
          i = end + 1;
          continue;
        }
        if (cLike) { i = scanString(src, i, lang, out); prevSignificant = '"'; prevClass = 'str'; continue; }
        var e = src.indexOf('"', i + 1);
        if (e === -1) e = src.length - 1;
        push('str', src.slice(i, e + 1));
        i = e + 1;
        continue;
      }
      if (ch === "'" && (lang === 'bash' || lang === 'kotlin' || lang === 'gradle')) {
        var close = src.indexOf("'", i + 1);
        var nl = src.indexOf('\n', i + 1);
        if (close !== -1 && (nl === -1 || close < nl)) { push('str', src.slice(i, close + 1)); i = close + 1; continue; }
      }

      if (cLike && ch === '@' && (m = match(RE.attribute, src, i))) { push('attr', m); i += m.length; continue; }
      if (lang === 'swift' && ch === '#' && (m = match(RE.directive, src, i))) { push('macro', m); i += m.length; continue; }

      if (/\d/.test(ch) && !isWordChar(src[i - 1]) && (m = match(RE.number, src, i))) { push('num', m); i += m.length; continue; }

      if ((m = match(RE.ident, src, i))) {
        var cls = '';
        var afterDot = prevSignificant === '.' && src[i - 1] === '.';
        var nextNonSpace = src.slice(i + m.length).match(/^[ \t]*(\S)/);
        var next = nextNonSpace ? nextNonSpace[1] : '';
        if (lang === 'json') {
          cls = (m === 'true' || m === 'false' || m === 'null') ? 'kw' : '';
        } else if (lang === 'bash') {
          cls = kw.has(m) ? 'kw' : (prevSignificant === '' || prevSignificant === '\n' ? 'fn' : '');
        } else if (afterDot) {
          cls = (lang === 'swift' && DOT_KEYWORDS.has(m)) ? 'kw' : (next === '(' ? 'fn' : 'prop');
        } else if (kw.has(m)) {
          cls = 'kw';
        } else if (prevClass === 'kw' && (prevSignificant === 'func' || prevSignificant === 'fun')) {
          cls = 'decl';
        } else if (next === '(' && !CONTROL.has(m)) {
          cls = /^[A-Z]/.test(m) ? 'typ' : 'fn';
        } else if (/^[A-Z]/.test(m)) {
          cls = 'typ';
        }
        push(cls, m);
        i += m.length;
        continue;
      }

      push('', ch);
      i++;
    }
    return out;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Devuelve un array de líneas HTML ya resaltadas. */
  function highlightLines(code, lang) {
    var tokens = tokenize(code, lang || 'text');
    var lines = [''];
    tokens.forEach(function (tok) {
      var parts = tok.t.split('\n');
      parts.forEach(function (part, idx) {
        if (idx > 0) lines.push('');
        if (!part) return;
        var html = escapeHtml(part);
        lines[lines.length - 1] += tok.c ? '<span class="t-' + tok.c + '">' + html + '</span>' : html;
      });
    });
    return lines;
  }

  global.Highlight = { lines: highlightLines, tokenize: tokenize };
})(typeof window !== 'undefined' ? window : globalThis);
