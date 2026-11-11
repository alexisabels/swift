/* Checklist de revisión para features SwiftUI que consumen el módulo KMP */
(function () {
  'use strict';

  Curso.checklist([
    {
      group: 'Arquitectura y capas',
      items: [
        { id: 'arq-sin-shared', text: 'Las vistas SwiftUI no importan `Shared`: hablan con ViewModels, que usan protocolos Swift implementados por el adaptador.', why: 'Aísla la UI del puente (SKIE hoy, Swift export mañana) y mantiene previews y tests rápidos.', lesson: 'arquitectura' },
        { id: 'arq-vm-nativo', text: 'Cada pantalla tiene un ViewModel Swift `@MainActor` y `@Observable` que orquesta casos de uso sin reglas de negocio propias.', why: 'El negocio ya vive en KMP; el ViewModel solo traduce dominio a estado de pantalla.', lesson: 'arquitectura' },
        { id: 'arq-logica-kmp', text: 'Las reglas de negocio nuevas (validaciones, cálculos, políticas) se añaden en KMP, no en Swift.', why: 'Si la regla vive en Swift, Android tendrá otra versión y acabarán divergiendo.', lesson: 'arquitectura' },
        { id: 'arq-composition-root', text: 'Las dependencias (incluido el contenedor de KMP) se crean una sola vez en el composition root y se inyectan por `init`.', why: 'Evita singletons y *service locators* escondidos dentro de las vistas.', lesson: 'dependencias' },
      ],
    },
    {
      group: 'Contrato KMP (lado Kotlin)',
      items: [
        { id: 'kmp-throws', text: 'Toda función pública que puede fallar declara `@Throws`; en las `suspend`, incluyendo `CancellationException`.', why: 'Una excepción no declarada que llega a Swift termina la app.', lesson: 'sealed-errores' },
        { id: 'kmp-nombres', text: 'La API pública no usa nombres que chocan con Swift (`Task`, `Result`, `Error`, `Data`, `URL`…).', why: 'Evita ocultar tipos estándar y escribir `_Concurrency.Task` por todo el código.', lesson: 'kotlin-desde-swift' },
        { id: 'kmp-genericos', text: 'La API para Swift no expone interfaces genéricas ni depende de argumentos por defecto.', why: 'El export a Objective-C pierde los genéricos de las interfaces y no conserva los valores por defecto.', lesson: 'kotlin-desde-swift' },
        { id: 'kmp-errores-datos', text: 'Los errores de dominio se modelan con una jerarquía `sealed` (dentro de una excepción de dominio), no como `String`.', why: 'Swift puede hacer un `switch` exhaustivo con `onEnum(of:)` y traducir cada caso.', lesson: 'sealed-errores' },
        { id: 'kmp-main-safe', text: 'Las funciones `suspend` públicas son *main-safe*: cambian de dispatcher por dentro para el trabajo pesado.', why: 'El ViewModel `@MainActor` las llama desde el hilo principal.', lesson: 'suspend-flow' },
        { id: 'kmp-flows-errores', text: 'Los `Flow` públicos capturan sus errores y los emiten como estado en lugar de terminar con una excepción.', why: 'Así la UI recibe el error como dato, sea cual sea el puente.', lesson: 'suspend-flow' },
        { id: 'kmp-api-revisada', text: 'Los PR que cambian la API pública incluyen una revisión de la API Swift generada por alguien de iOS.', why: 'Es el contrato real que consume la app.', lesson: 'equipo' },
      ],
    },
    {
      group: 'Capa adaptadora',
      items: [
        { id: 'ada-protocolo', text: 'Cada servicio tiene un protocolo Swift con una implementación KMP y al menos un fake.', why: 'Permite previews, tests y cambiar de puente sin tocar la UI.', lesson: 'capa-adaptadora' },
        { id: 'ada-structs', text: 'Los modelos Kotlin se mapean a structs Swift `Sendable` (y `Identifiable`/`Hashable` si se pintan en listas).', why: 'Tipos de valor seguros entre actores y con identidad estable.', lesson: 'capa-adaptadora' },
        { id: 'ada-errores', text: 'Los errores Kotlin se traducen a un `enum` Swift (p. ej. `LibraryFailure`) en un único sitio.', why: 'El ViewModel trabaja con errores exhaustivos sin conocer `NSError` ni `kotlinException`.', lesson: 'capa-adaptadora' },
        { id: 'ada-tipos', text: 'El mapeo convierte `Int32`/`Int64`/`KotlinInt` a `Int` y los strings de URL o fecha a tipos de Foundation.', why: 'La UI no debería ver tipos del puente ni formatos de transporte.', lesson: 'kotlin-desde-swift' },
      ],
    },
    {
      group: 'Estado y SwiftUI',
      items: [
        { id: 'ui-estado-enum', text: 'El estado de cada pantalla es un `enum` (cargando, contenido, vacío, error) y no una colección de booleanos sueltos.', why: 'Hace imposibles los estados imposibles.', lesson: 'errores-enums' },
        { id: 'ui-state-private', text: 'Los objetos que la vista posee están en `@State private`; los que recibe, como `let` o `@Bindable`.', why: 'Evita ViewModels recreados y estado perdido.', lesson: 'estado' },
        { id: 'ui-init-barato', text: 'Ni el `init` de las vistas ni el de los ViewModels hace trabajo: la carga empieza en `.task`.', why: 'Los `init` de las vistas se ejecutan muchas veces y lo que lanzan no se puede cancelar.', lesson: 'ciclo-vida' },
        { id: 'ui-identidad', text: '`List` y `ForEach` usan ids estables del dominio (nunca índices ni `UUID()` creados al vuelo).', why: 'La identidad decide la vida del estado, las tareas y las animaciones.', lesson: 'composicion' },
        { id: 'ui-navegacion', text: 'La navegación usa `NavigationStack(path:)` con rutas `Hashable` que llevan ids, no objetos.', why: 'Navegación programable, testeable y lista para deep links.', lesson: 'navegacion' },
        { id: 'ui-previews', text: 'Hay previews de cada estado (cargando, vacío, error, contenido) que usan fakes y nunca arrancan KMP.', why: 'Feedback inmediato sin el runtime de Kotlin.', lesson: 'previews' },
      ],
    },
    {
      group: 'Concurrencia',
      items: [
        { id: 'con-swift6', text: 'El target compila en Swift 6 language mode sin avisos de concurrencia.', why: 'Los *data races* pasan a ser errores de compilación.', lesson: 'aislamiento' },
        { id: 'con-task', text: 'El trabajo asíncrono de la UI cuelga de `.task`, `.task(id:)` o `.refreshable`; no hay `Task {}` sin dueño en `onAppear` ni `Task.detached`.', why: 'La cancelación automática evita trabajo y fugas al salir de la pantalla.', lesson: 'ciclo-vida' },
        { id: 'con-flows', text: 'La recolección de los Flows de KMP se cancela al desaparecer la pantalla (puente con cancelación, como SKIE).', why: 'Sin cancelación, los Flows siguen activos y consumiendo recursos.', lesson: 'suspend-flow' },
        { id: 'con-ciclos', text: 'Los callbacks que se entregan a Kotlin no crean ciclos de retención (`[weak self]`, desuscripción explícita).', why: 'Un ciclo que cruza la frontera Swift↔Kotlin no se libera de forma fiable.', lesson: 'dependencias' },
      ],
    },
    {
      group: 'Errores',
      items: [
        { id: 'err-try-opcional', text: 'Ningún `try?` oculta errores que el usuario debería conocer.', why: 'Un fallo silencioso es indistinguible de «no hay datos».', lesson: 'errores-enums' },
        { id: 'err-force', text: 'No hay `!` ni `as!` sobre datos externos (red, KMP, entrada del usuario).', why: 'Cada *force unwrap* es un crash esperando a un dato inesperado.', lesson: 'opcionales' },
        { id: 'err-cancelacion', text: 'La cancelación no se muestra como error al usuario.', why: 'Salir de una pantalla o seguir escribiendo no es un fallo.', lesson: 'async-await' },
      ],
    },
    {
      group: 'Accesibilidad y localización',
      items: [
        { id: 'a11y-dynamic-type', text: 'Los textos usan estilos (`.body`, `.headline`) y escalan con Dynamic Type; las medidas, con `@ScaledMetric`.', why: 'Muchas personas usan tamaños de texto grandes.', lesson: 'calidad-ui' },
        { id: 'a11y-botones', text: 'Toda acción es un `Button` (no `onTapGesture`) y los botones de solo icono tienen `accessibilityLabel`.', why: 'VoiceOver anuncia los botones y su propósito.', lesson: 'calidad-ui' },
        { id: 'l10n-catalogo', text: 'Todos los textos visibles están en el String Catalog, con variantes de plural donde haga falta.', why: 'Sin catálogo no hay traducción ni plurales correctos.', lesson: 'calidad-ui' },
        { id: 'l10n-formatos', text: 'Fechas, números y monedas se formatean con `FormatStyle` según el locale del usuario.', why: 'Cada región escribe fechas y números de forma distinta.', lesson: 'calidad-ui' },
      ],
    },
    {
      group: 'Testing',
      items: [
        { id: 'test-vm', text: 'Los ViewModels tienen tests de transiciones de estado con Swift Testing y fakes.', why: 'La lógica de presentación es la que más cambia y la más barata de testear.', lesson: 'testear-viewmodels' },
        { id: 'test-mapeo', text: 'El mapeo Kotlin → Swift (modelos y errores) tiene tests que usan tipos reales de `Shared`.', why: 'Es el punto donde un cambio del contrato KMP rompe la app.', lesson: 'testear-viewmodels' },
        { id: 'test-commontest', text: 'Las reglas de negocio se testean en `commonTest` de KMP, no en los tests de iOS.', why: 'Se escriben una vez y cubren las dos plataformas.', lesson: 'testear-viewmodels' },
        { id: 'test-deterministas', text: 'Los tests no dependen de esperas reales ni de red: fakes deterministas y tiempos (debounce) inyectados.', why: 'Los tests lentos o intermitentes acaban ignorados.', lesson: 'testear-viewmodels' },
      ],
    },
    {
      group: 'Rendimiento y entrega',
      items: [
        { id: 'rend-body', text: '`body` no ordena, filtra ni crea formatters: recibe datos listos para pintar.', why: '`body` se evalúa muchas veces.', lesson: 'calidad-ui' },
        { id: 'ent-versiones', text: 'Las versiones de Kotlin, SKIE y demás plugins están fijadas en el version catalog y se actualizan juntas.', why: 'SKIE depende del compilador de Kotlin y no siempre soporta la última versión.', lesson: 'integracion-xcode' },
        { id: 'ent-crashes', text: 'Los dSYM (con los símbolos de Kotlin) se suben a la herramienta de crashes y las excepciones Kotlin se reportan con su traza (p. ej. CrashKiOS).', why: 'Sin símbolos, un crash del framework es una traza ilegible.', lesson: 'integracion-xcode' },
        { id: 'ent-cocoapods', text: 'La entrega del framework no depende de publicar en el trunk de CocoaPods (solo lectura desde el 2 de diciembre de 2026).', why: 'Por esa vía ya no se pueden publicar versiones nuevas.', lesson: 'integracion-xcode' },
      ],
    },
  ]);
})();
