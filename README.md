# SwiftUI sobre KMP

Curso interactivo (aplicación web) para aprender **buenas prácticas de Swift y SwiftUI** en una app iOS cuyos casos de uso, repositorios y acceso a datos viven en un módulo **Kotlin Multiplatform (KMP)** compartido con Android.

- **31 lecciones** en 7 módulos, con ideas clave y un test al final de cada una (112 preguntas).
- **Proyecto guiado**: la feature «Biblioteca» de principio a fin (contrato KMP → adaptador Swift → ViewModel → vistas y previews → tests).
- **Arquitectura interactiva**: qué hace cada capa y un juego para decidir dónde va cada pieza de código.
- **Kotlin → Swift**: 16 construcciones de Kotlin y cómo llegan a Swift con el export Objective‑C, con SKIE y con Swift export.
- **Retos de code review**: 7 fragmentos con fallos que tienes que encontrar antes de ver la solución.
- **Checklist de PR** (copiable como Markdown) y **glosario** Kotlin ↔ Swift.
- Buscador (`/` o `⌘K`), tema claro/oscuro y progreso guardado en el navegador.

Contenido revisado para **noviembre de 2026**: Swift 6.4 / Xcode 27, iOS 17+, Kotlin 2.4.x, SKIE 0.10.x y Swift export (Alpha).

## Cómo abrirla

No tiene dependencias ni paso de compilación.

- **Directamente**: abre `index.html` en el navegador (funciona con `file://`).
- **Con un servidor local**: `python3 -m http.server 8000` (o `npm start`) y visita <http://localhost:8000>.
- **Un solo fichero para compartir**: `node scripts/build-single.js` genera `dist/swiftui-sobre-kmp.html` con todo incrustado.
- **GitHub Pages**: en *Settings → Pages*, publica desde la rama y la carpeta raíz.

## Ruta de aprendizaje

| # | Módulo | Qué aprendes |
|---|--------|--------------|
| 1 | Swift moderno | Mapa mental Kotlin → Swift, tipos de valor, opcionales, protocolos, enums y errores tipados |
| 2 | Concurrencia en Swift 6 | async/await, `@MainActor`, actores, `Sendable`, Approachable Concurrency, `AsyncSequence` |
| 3 | SwiftUI con buenas prácticas | Observation, composición e identidad, `.task`, navegación tipada, previews, rendimiento y accesibilidad |
| 4 | Integración con KMP | Arquitectura, cómo ve Swift el código Kotlin, SKIE / Swift export, `suspend` y `Flow`, errores, capa adaptadora, dependencias y memoria |
| 5 | Testing | Swift Testing y tests de ViewModels que dependen de KMP |
| 6 | Proyecto guiado | La feature «Biblioteca» completa |
| 7 | Proyecto y herramientas | Integrar el framework en Xcode, versiones, lint y trabajo con el equipo KMP |

## Estructura

```
index.html                 Esqueleto de la app
assets/css/styles.css      Estilos (temas claro y oscuro)
assets/js/curso.js         Registro de contenido y mini-DSL para escribir lecciones
assets/js/app.js           Router, vistas e interacción
assets/js/highlight.js     Resaltado de Swift (paleta de Xcode) y Kotlin (paleta de IntelliJ)
assets/js/diagrams.js      Diagramas SVG
assets/js/store.js         Progreso en localStorage
assets/content/            Lecciones, retos, glosario, checklist, interop y arquitectura
scripts/validate.js        Validación del contenido (estructura, tests, enlaces, retos)
scripts/build-single.js    Empaquetado en un único HTML
```

## Añadir o editar lecciones

Cada módulo es un fichero de `assets/content/` que usa la mini-DSL de `curso.js`:

```js
(function () {
  const { p, h, code, compare, tabs, note, list, steps, table, keys, diagram, q, S } = Curso.dsl;

  Curso.module({
    id: 'swiftui', order: 3, title: 'SwiftUI con buenas prácticas', short: 'SwiftUI', icon: 'layout',
    description: '…',
    lessons: [{
      id: 'estado', title: 'Estado y flujo de datos con Observation',
      level: 'Básico', minutes: 12, tags: ['@State', '@Observable'], summary: '…',
      blocks: [
        p('Texto con `código`, **negrita** y [enlaces](#/l/composicion).'),
        compare('swift', S`…evita…`, S`…mejor…`, { bad: 'por qué', good: 'por qué' }),
        note('kmp', 'Título', 'Texto'),
        keys(['Idea clave'])
      ],
      quiz: [q('Pregunta', ['A', 'B', 'C'], 1, 'Explicación')]
    }]
  });
})();
```

- El código va siempre con `` S`…` `` (`String.raw`) para conservar las barras de Swift (`\(valor)`).
- No uses `${` en el contenido: en Kotlin, escribe `"$nombre"`.
- Si creas un fichero nuevo, añádelo a `index.html`.

Antes de subir cambios, ejecuta:

```bash
node scripts/validate.js
```

Comprueba ids duplicados, respuestas de los tests, enlaces internos rotos, líneas de los retos y que `index.html` carga todos los ficheros. La misma validación se ejecuta en GitHub Actions.
