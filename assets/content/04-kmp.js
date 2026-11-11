(function () {
  'use strict';
  const { p, h, code, compare, tabs, note, list, steps, table, keys, diagram, q, S } = Curso.dsl;

  Curso.module({
    id: 'kmp',
    order: 4,
    title: 'Integración con KMP',
    short: 'SwiftUI + KMP',
    icon: 'bridge',
    description: 'La frontera entre Swift y Kotlin: qué vive en cada lado, cómo llega el código Kotlin a Swift, suspend y Flow, errores, la capa adaptadora y las dependencias.',
    lessons: [
      // -----------------------------------------------------------------------
      {
        id: 'arquitectura',
        title: 'Arquitectura: qué vive en KMP y qué en Swift',
        level: 'Intermedio',
        minutes: 12,
        tags: ['arquitectura', 'capas', 'ViewModel', 'Clean Architecture'],
        summary: 'Dónde poner cada responsabilidad cuando el dominio y los datos llegan de Kotlin y la interfaz es SwiftUI nativa.',
        blocks: [
          p('En un proyecto Kotlin Multiplatform como el tuyo, Android e iOS comparten el «cerebro» (reglas de negocio y acceso a datos) y cada plataforma conserva su interfaz nativa. Tu trabajo en iOS no es reescribir esa lógica, sino **consumirla bien**: convertirla en estado de pantalla, pintarla con SwiftUI y mantener limpia la frontera entre los dos lenguajes.'),
          diagram('arquitectura'),
          h('El reparto de responsabilidades'),
          table(['Capa', 'Lenguaje', 'Responsabilidad', 'Ejemplo'], [
            ['Dominio', 'Kotlin (`commonMain`)', 'Reglas de negocio, casos de uso, entidades, interfaces de repositorio y errores de dominio.', '`GetBookUseCase`, `Book`, `LibraryError`'],
            ['Datos', 'Kotlin', 'Implementa los repositorios: red (Ktor), base de datos (SQLDelight o Room), caché, mapeo de DTO a dominio.', '`DefaultBookRepository`'],
            ['Adaptador', 'Swift', 'La única puerta a KMP: protocolos Swift, modelos `Sendable`, traducción de errores, de `Flow` a `AsyncStream`.', '`KMPLibraryService`'],
            ['ViewModel', 'Swift', 'Estado de pantalla, orquesta llamadas, prepara los datos para mostrar.', '`LibraryViewModel`'],
            ['Vista', 'Swift (SwiftUI)', 'Pinta el estado y comunica las intenciones del usuario.', '`LibraryScreen`']
          ]),
          h('La regla de dependencias'),
          p('Las flechas siempre apuntan hacia abajo: Vista → ViewModel → Adaptador → Dominio, y Datos implementa las interfaces del Dominio. El dominio no conoce a nadie. En Swift, **solo la capa de integración (adaptadores y composition root) hace `import Shared`**. Si una vista o un ViewModel necesita un tipo de Kotlin, te falta un tipo Swift en el adaptador.'),
          compare('swift', S`
            import SwiftUI
            import Shared

            struct BooksScreen: View {
                @State private var books: [Book] = []   // tipo de Kotlin en la vista

                var body: some View {
                    List(books, id: \.id) { book in
                        Text(book.title)
                    }
                    .task {
                        let useCase = KoinHelper.shared.getBooksUseCase()  // service locator
                        books = (try? await useCase.invoke()) ?? []        // error tragado
                    }
                }
            }
          `, S`
            import SwiftUI   // sin import Shared

            struct LibraryScreen: View {
                @State private var viewModel: LibraryViewModel

                init(service: any LibraryService) {
                    _viewModel = State(initialValue: LibraryViewModel(service: service))
                }

                var body: some View {
                    LibraryContent(state: viewModel.state)
                        .task { await viewModel.start() }
                        .refreshable { await viewModel.refresh() }
                }
            }
          `, {
            bad: 'La vista conoce Kotlin, busca sus dependencias por su cuenta y se traga los errores. No se puede previsualizar sin arrancar KMP y es muy difícil de testear.',
            good: 'La vista solo conoce tipos Swift. El ViewModel recibe un protocolo, así que previews y tests usan un fake y nadie arranca KMP sin querer.'
          }),
          h('¿ViewModel compartido o nativo?'),
          p('Hay dos escuelas. Con los casos de uso ya en KMP (tu caso), la opción por defecto razonable es un **ViewModel nativo** `@Observable` en Swift que llama a esos casos de uso a través del adaptador.'),
          table(['Criterio', 'ViewModel nativo (Swift)', 'ViewModel compartido (KMP)'], [
            ['Sensación nativa', 'Total: `@Observable`, `async/await`, previews.', 'Depende de envoltorios (SKIE, KMP-ObservableViewModel).'],
            ['Duplicación', 'Algo de lógica de presentación se escribe dos veces.', 'Menos duplicación.'],
            ['Ciclo de vida', 'El de SwiftUI, sin sorpresas.', 'Hay que limpiar el ViewModel de Kotlin desde Swift.'],
            ['Depuración', 'Breakpoints e Instruments de Xcode.', 'Saltas entre dos lenguajes en un mismo flujo.'],
            ['Encaja cuando…', 'Hay equipo iOS propio y la UI tiene personalidad de plataforma.', 'El equipo es pequeño, las pantallas son casi idénticas y hay mucha lógica de presentación.']
          ]),
          note('kmp', 'Si tu equipo comparte ViewModels', 'Trátalos como un caso de uso más: envuélvelos en un tipo Swift `@Observable` que observe su `StateFlow` y exponga estado Swift. Tus vistas no cambiarán si mañana el ViewModel pasa a ser nativo. Y límpialo (su `viewModelScope`) cuando la pantalla desaparezca.'),
          h('Qué no compartir'),
          list([
            '**Textos y formato** (fechas, números, plurales): son presentación. Usa String Catalogs y `.formatted()` en Swift, salvo que el equipo haya decidido compartirlos de forma explícita.',
            '**Navegación**: cada plataforma tiene su modelo (`NavigationStack` frente a Navigation Compose).',
            '**APIs de plataforma** (Keychain, notificaciones, biometría): defínelas como interfaces en Kotlin e impleméntalas en Swift. Lo verás en [Dependencias y servicios de plataforma](#l-dependencias).'
          ]),
          keys([
            'KMP aporta dominio y datos; tú aportas adaptador, ViewModels y vistas.',
            'Solo la capa de integración importa `Shared`: vistas y ViewModels hablan Swift puro.',
            'Con los casos de uso en KMP, el ViewModel nativo `@Observable` es la opción por defecto.',
            'Textos, formato y navegación se quedan en Swift.'
          ])
        ],
        quiz: [
          q('¿Qué código de la app iOS debería hacer `import Shared`?', [
            'Todo el que lo necesite',
            'Solo la capa de integración: adaptadores y composition root',
            'Solo las vistas',
            'Ninguno: el módulo KMP se consume por red'
          ], 1, 'El adaptador es la frontera: traduce tipos y errores de Kotlin a Swift. El composition root también lo importa para crear las dependencias. Vistas y ViewModels, no.'),
          q('Tu pantalla muestra la fecha de publicación como «12 mar 2026». ¿Dónde se formatea?', [
            'En un caso de uso de Kotlin, para no duplicar',
            'En Swift, con las APIs de formato, al preparar o pintar el estado',
            'En el repositorio, al guardar en la base de datos'
          ], 1, 'El formato depende del idioma y la región del dispositivo y es presentación. El dominio entrega un dato (una fecha), y Swift lo formatea con `.formatted()` o `Text(_:format:)`.'),
          q('Con el dominio en KMP y la UI en SwiftUI, ¿qué opción es la razonable por defecto?', [
            'ViewModel compartido en KMP, siempre',
            'ViewModel nativo `@Observable` que llama a los casos de uso a través del adaptador',
            'Sin ViewModel: la vista llama directamente a los casos de uso'
          ], 1, 'Te da la experiencia nativa completa (Observation, async/await, previews) y aísla Kotlin en una sola capa. Compartir ViewModels es válido, pero tiene más costes de integración.')
        ]
      },

      // -----------------------------------------------------------------------
      {
        id: 'kotlin-desde-swift',
        title: 'Cómo ve Swift tu código Kotlin',
        level: 'Intermedio',
        minutes: 14,
        tags: ['Objective-C', 'interop', 'KotlinInt', '@ObjCName', 'nombres'],
        summary: 'El framework Shared llega a Swift a través de una cabecera Objective-C: qué se traduce bien, qué se pierde y cómo pedir una API cómoda.',
        blocks: [
          p('Por defecto, Kotlin/Native genera un framework con una **cabecera Objective-C**, y Swift importa esa cabecera. Entre tu Kotlin y tu Swift hay, por tanto, un intermediario con las limitaciones de Objective-C. Casi todo funciona, pero algunas traducciones conviene conocerlas para no pelearte con ellas.'),
          diagram('puente'),
          h('La tabla que conviene tener a mano'),
          table(['Kotlin', 'En Swift (export Obj-C)', 'Qué hacer'], [
            ['`Int`, `Long`', '`Int32`, `Int64`', 'Convierte a `Int` en el adaptador.'],
            ['`Int?`, `Boolean?`', '`KotlinInt?`, `KotlinBoolean?` (cajas de `NSNumber`)', 'Usa `.intValue` o `.boolValue` al mapear.'],
            ['`List<T>`, `Map<K, V>`, `Set<T>`', '`[T]`, `[K: V]`, `Set<T>`', 'Directo. Dentro de genéricos, los primitivos llegan en caja.'],
            ['`Unit` en lambdas', '`KotlinUnit`', 'Las closures devuelven `KotlinUnit()`. Mejor evita lambdas en la API pública.'],
            ['`object Foo`', '`Foo.shared`', '—'],
            ['`companion object`', '`Foo.companion`', '—'],
            ['`data class`', 'Clase con `doCopy(...)`, `isEqual` y `hash`', 'Mapéala a un `struct` Swift.'],
            ['`enum class`', 'Clase con propiedades estáticas', 'Sin `switch` exhaustivo (SKIE lo arregla).'],
            ['`sealed class`', 'Jerarquía de clases', 'Sin `switch` exhaustivo (SKIE lo arregla).'],
            ['`suspend fun`', '`async` (o completion handler)', 'Sin cancelación si no usas un puente como SKIE.'],
            ['`Flow<T>`', 'Protocolo opaco de kotlinx.coroutines', 'Necesitas SKIE, KMP-NativeCoroutines o Swift export.'],
            ['Parámetros por defecto', 'No existen: todos son obligatorios', 'Pide sobrecargas o activa la opción de SKIE.'],
            ['Genéricos en interfaces y funciones', 'Se pierden', 'Evítalos en la API pública.'],
            ['Excepciones', 'Crash si no están en `@Throws`', 'Lo ves en [errores entre lenguajes](#l-sealed-errores).']
          ]),
          note('tip', 'Pruébalo tú en la herramienta', 'En [Kotlin → Swift](#interop) tienes cada construcción con su versión en Swift por defecto, con SKIE y con Swift export.'),
          h('Nombres: prefijos y choques'),
          p('Kotlin/Native exporta cada clase con el prefijo del framework en Objective-C (`SharedBook`) y un nombre Swift limpio (`Book`). Si dos clases se llaman igual en paquetes distintos, una recibe un guion bajo (`Book_`). Y si una clase se llama como algo de Swift (`Task`, `Result`, `Error`, `Data`), el choque acaba en tu código: con `import Shared`, `Task { }` deja de ser la tarea de Swift.'),
          compare('kotlin', S`
            // El dominio de una app de tareas…
            data class Task(val id: String, val title: String)

            sealed interface Result {
                data class Success(val tasks: List<Task>) : Result
                data class Failure(val message: String) : Result
            }
          `, S`
            @file:OptIn(ExperimentalObjCName::class)

            import kotlin.experimental.ExperimentalObjCName
            import kotlin.native.ObjCName

            @ObjCName(swiftName = "TodoTask")
            data class Task(val id: String, val title: String)

            sealed interface LoadTasksResult {
                data class Success(val tasks: List<Task>) : LoadTasksResult
                data class Failure(val message: String) : LoadTasksResult
            }
          `, {
            bad: '`Task` y `Result` tapan a los de Swift en todos los ficheros que importen `Shared`: el equipo iOS acaba escribiendo `_Concurrency.Task` por todas partes.',
            good: 'Se arregla en el origen: un nombre Swift distinto con `@ObjCName` o, mejor aún, un nombre más específico para todos.'
          }),
          p('Si no puedes cambiar el Kotlin, desde Xcode 27 tienes los selectores de módulo: `Shared::Task` se refiere sin ambigüedad a la clase de Kotlin. Es un parche útil, no una solución.'),
          h('Anotaciones que mejoran la API para Swift'),
          code('kotlin', S`
            @file:OptIn(ExperimentalObjCName::class, ExperimentalObjCRefinement::class)

            import kotlin.coroutines.cancellation.CancellationException
            import kotlin.experimental.ExperimentalObjCName
            import kotlin.experimental.ExperimentalObjCRefinement
            import kotlin.native.HiddenFromObjC
            import kotlin.native.ObjCName
            import kotlin.native.ShouldRefineInSwift

            class SearchBooksUseCase(private val repository: BookRepository) {

                // Swift verá search(query:) en lugar de invoke(query:)
                @ObjCName(swiftName = "search")
                @Throws(LibraryException::class, CancellationException::class)
                suspend operator fun invoke(query: String): List<Book> = repository.search(query)

                // Solo para Android: Swift no la verá
                @HiddenFromObjC
                fun debugDump(): String = repository.toString()

                // Swift la verá como __pageInfo(): el equipo iOS escribe encima una versión idiomática
                @ShouldRefineInSwift
                fun pageInfo(): Pair<Int, Int> = 0 to 20
            }
          `, 'SearchBooksUseCase.kt'),
          note('warn', 'Son anotaciones experimentales', '`@ObjCName`, `@HiddenFromObjC` y `@ShouldRefineInSwift` necesitan opt-in. Pide al equipo KMP que lo active a nivel de módulo en Gradle (`optIn`) para no llenar el código de `@OptIn`.'),
          p('Un detalle sobre `invoke`: Swift no convierte el `operator fun invoke` de Kotlin en `callAsFunction`, así que llamas a `useCase.invoke(id:)`. Si te molesta, añade en tu adaptador una extensión con `callAsFunction`, o pide un nombre explícito como en el ejemplo.'),
          h('Lee la cabecera generada'),
          p('Cuando dudes de cómo llega algo, no adivines: en Xcode, ⌘-clic sobre el tipo (o abre `Shared.framework/Headers/Shared.h`) y mira la firma real. Esa es la API que vas a consumir. Revisarla en las PR del módulo compartido evita sorpresas a las dos plataformas.'),
          keys([
            'El export por defecto pasa por Objective-C: números de tamaño fijo, opcionales en caja, sin enums Swift ni parámetros por defecto.',
            'Convierte tipos (`Int32` → `Int`, `KotlinInt?` → `Int?`) en el adaptador, nunca en la vista.',
            'Evita nombres que choquen con Swift (`Task`, `Result`, `Error`…) o renómbralos con `@ObjCName`.',
            'Revisa la cabecera generada como revisarías un contrato de API.'
          ])
        ],
        quiz: [
          q('Una propiedad Kotlin `val pages: Int?` llega a Swift como…', ['`Int?`', '`Int32?`', '`KotlinInt?`', '`String?`'], 2,
            'Los primitivos opcionales viajan en caja: `KotlinInt` es una subclase de `NSNumber`. En el adaptador conviértelo con `pages?.intValue`.'),
          q('¿Qué pasa con `fun search(query: String, limit: Int = 20)` en Swift si no usas SKIE?', [
            'Swift respeta el valor por defecto',
            'Swift tiene que pasar siempre `limit`',
            'La función no se exporta'
          ], 1, 'Objective-C no tiene parámetros por defecto: el export los ignora y todos los argumentos son obligatorios. SKIE puede generar sobrecargas; también puedes pedir funciones explícitas.'),
          q('El módulo compartido define `class Result<T>`. ¿Cuál es la mejor solución?', [
            'Escribir `Swift.Result` en toda la app',
            'Renombrarla en Kotlin o exponerla con otro nombre mediante `@ObjCName`',
            'No importar `Shared` en ningún fichero'
          ], 1, 'Arreglarlo en el origen beneficia a todos los consumidores. Calificar el nombre con el módulo funciona, pero ensucia todo el código Swift.')
        ]
      },

      // -----------------------------------------------------------------------
      {
        id: 'puentes',
        title: 'SKIE, KMP-NativeCoroutines y Swift export',
        level: 'Intermedio',
        minutes: 12,
        tags: ['SKIE', 'KMP-NativeCoroutines', 'Swift export', 'interop'],
        summary: 'Qué resuelve cada herramienta, en qué estado están en noviembre de 2026 y cómo elegir sin quedarte atado a ninguna.',
        blocks: [
          p('El export Objective-C deja tres huecos importantes: enums y sealed sin `switch` exhaustivo, `suspend` sin cancelación y `Flow` inutilizable. Tres herramientas los cubren de formas distintas.'),
          table(['Herramienta', 'Qué hace', 'Estado (nov. 2026)', 'Ten en cuenta'], [
            ['**SKIE** (Touchlab)', 'Plugin de Gradle que genera Swift encima de la cabecera Obj-C: enums Swift, `onEnum(of:)` para sealed, `async` con cancelación, `Flow` → `AsyncSequence`, parámetros por defecto opcionales.', 'Estable y muy usado. Última versión: 0.10.12 (mayo de 2026).', 'Va ligado a versiones concretas de Kotlin y a veces tarda en soportar la última. Fija versiones compatibles.'],
            ['**KMP-NativeCoroutines**', 'Anotas con `@NativeCoroutines` y en Swift usas `asyncFunction(for:)` y `asyncSequence(for:)`. También ofrece Combine y RxSwift.', 'Estable.', 'Más explícito y verboso; necesita KSP y una librería Swift. Útil si ya lo usáis o queréis Combine.'],
            ['**Swift export** (JetBrains)', 'Exporta Kotlin directamente como módulo Swift, sin Objective-C.', 'Alpha desde Kotlin 2.4.0 (`suspend` → `async`, `Flow` → `AsyncSequence`); sealed desde 2.4.20.', 'Es el futuro oficial, pero aún incompleto y con cambios incompatibles previstos.']
          ]),
          diagram('puente'),
          h('El mismo caso de uso con cada opción'),
          tabs([
            ['Kotlin', 'kotlin', S`
              class ObserveBooksUseCase(private val repository: BookRepository) {
                  operator fun invoke(): Flow<List<Book>> = repository.observeBooks()
              }

              class RefreshBooksUseCase(private val repository: BookRepository) {
                  @Throws(LibraryException::class, CancellationException::class)
                  suspend operator fun invoke() = repository.refresh()
              }
            `],
            ['Swift · SKIE', 'swift', S`
              // suspend → async, con cancelación en los dos sentidos
              try await refreshBooks.invoke()

              // Flow<List<Book>> → AsyncSequence
              for await books in observeBooks.invoke() {
                  print(books.count)
              }
            `],
            ['Swift · NativeCoroutines', 'swift', S`
              import KMPNativeCoroutinesAsync
              // En Kotlin, cada función lleva @NativeCoroutines

              try await asyncFunction(for: refreshBooks.invoke())

              for try await books in asyncSequence(for: observeBooks.invoke()) {
                  print(books.count)
              }
            `],
            ['Swift · sin puente', 'swift', S`
              // suspend: funciona como async, pero si cancelas la Task de Swift
              // la corrutina de Kotlin sigue trabajando hasta terminar
              try await refreshBooks.invoke()

              // Flow: llega como un protocolo de kotlinx.coroutines, sin AsyncSequence.
              // Tendrías que escribir en Kotlin un collector con callbacks.
              let flow = observeBooks.invoke()   // Kotlinx_coroutines_coreFlow
            `]
          ], 'Pulsa cada pestaña para comparar.'),
          h('Cómo elegir'),
          steps([
            '**Proyecto existente con SKIE**: quédate con SKIE. Fija Kotlin y SKIE en el catálogo de versiones y actualízalos juntos.',
            '**Proyecto nuevo**: hoy SKIE sigue siendo la opción más completa. Prueba Swift export en una rama para medir cuánto le falta para vuestro caso.',
            '**Ya usáis Combine o RxSwift**: KMP-NativeCoroutines encaja mejor.',
            '**Elijas lo que elijas**, escóndelo detrás de tu [capa adaptadora](#l-capa-adaptadora). Cuando Swift export madure, solo cambiará el adaptador, no tus vistas ni tus ViewModels.'
          ]),
          code('gradle', S`
            // shared/build.gradle.kts
            import co.touchlab.skie.configuration.DefaultArgumentInterop

            plugins {
                alias(libs.plugins.kotlinMultiplatform)
                alias(libs.plugins.skie)   // co.touchlab.skie, versión fijada en libs.versions.toml
            }

            skie {
                features {
                    // Parámetros por defecto como sobrecargas. Aumenta el tamaño del
                    // framework: mejor activarlo solo donde haga falta.
                    group {
                        DefaultArgumentInterop.Enabled(false)
                    }
                }
            }
          `, 'shared/build.gradle.kts'),
          note('new', 'Swift export en Kotlin 2.4.x', 'Se configura con el bloque `swiftExport { }` en Gradle y la tarea `embedSwiftExportForXcode` en la fase de build de Xcode. En 2.4.0 pasó a Alpha con `suspend` → `async` y `Flow` → `AsyncSequence`; en 2.4.20 llegaron las sealed classes. Merece la pena probarlo en una rama; en producción, todavía no.'),
          keys([
            'SKIE: la opción más completa y madura hoy; vigila la compatibilidad con cada versión de Kotlin.',
            'KMP-NativeCoroutines: explícito y con soporte de Combine y RxSwift.',
            'Swift export: el futuro oficial, en Alpha desde Kotlin 2.4.0. Pruébalo, aún no lo despliegues.',
            'Elijas lo que elijas, que solo lo vea el adaptador.'
          ])
        ],
        quiz: [
          q('Sin ningún puente, cancelas en Swift la `Task` que espera a una función `suspend` de Kotlin. ¿Qué ocurre?', [
            'La corrutina de Kotlin se cancela',
            'La corrutina de Kotlin sigue trabajando hasta terminar',
            'La app se cierra'
          ], 1, 'El export básico convierte `suspend` en un completion handler y la cancelación de Swift no llega a Kotlin. SKIE y Swift export sí la propagan.'),
          q('Actualizáis Kotlin a una versión recién publicada y el build iOS falla en el plugin de SKIE. ¿Qué es lo más probable?', [
            'Un bug de Xcode',
            'Esa versión de SKIE todavía no soporta la nueva versión de Kotlin',
            'Hay que volver a CocoaPods'
          ], 1, 'SKIE se engancha al compilador de Kotlin y cada versión soporta un rango concreto. Actualiza ambos juntos y consulta su tabla de compatibilidad antes de subir Kotlin.'),
          q('¿Por qué conviene esconder el puente detrás de un adaptador?', [
            'Porque SKIE no funciona dentro de las vistas',
            'Para cambiar de puente (por ejemplo, a Swift export) tocando una sola capa',
            'Porque mejora el rendimiento de SwiftUI'
          ], 1, 'Vistas y ViewModels dependen de protocolos y tipos Swift. Cambiar de SKIE a Swift export, o actualizar uno de ellos, afecta solo al adaptador y a sus tests.')
        ]
      },

      // -----------------------------------------------------------------------
      {
        id: 'suspend-flow',
        title: 'suspend y Flow desde SwiftUI',
        level: 'Avanzado',
        minutes: 14,
        tags: ['suspend', 'Flow', 'StateFlow', 'AsyncSequence', '.task', 'cancelación'],
        summary: 'Llamar a funciones suspend y observar Flows desde SwiftUI sin fugas, sin saltos de hilo innecesarios y con cancelación.',
        blocks: [
          p('Hay dos formas de hablar con el módulo compartido: **llamadas puntuales** (`suspend fun`) y **streams** (`Flow`, `StateFlow`). Con SKIE se convierten en `async` y `AsyncSequence`, y SwiftUI ya tiene el sitio perfecto para ambos: el modificador `.task`.'),
          diagram('flujo'),
          h('Llamadas suspend desde el ViewModel'),
          code('swift', S`
            @MainActor
            @Observable
            final class LibraryViewModel {
                private(set) var failure: LibraryFailure?
                private(set) var isRefreshing = false
                private let service: any LibraryService

                init(service: any LibraryService) {
                    self.service = service
                }

                func refresh() async {
                    isRefreshing = true
                    defer { isRefreshing = false }
                    do throws(LibraryFailure) {
                        try await service.refresh()   // Kotlin elige su dispatcher…
                        failure = nil                 // …y aquí volvemos al MainActor
                    } catch {
                        if error != .cancelled { failure = error }
                    }
                }
            }
          `, 'LibraryViewModel.swift'),
          note('info', '¿En qué hilo corre el código de Kotlin?', 'En el que decida Kotlin. Una función `suspend` bien escrita es *main-safe*: mueve el trabajo pesado con `withContext(Dispatchers.Default)` o `Dispatchers.IO`. Tu ViewModel es `@MainActor`, así que tras cada `await` Swift te devuelve al hilo principal y puedes tocar el estado sin `DispatchQueue.main`.'),
          h('Flows: obsérvalos dentro de .task'),
          compare('swift', S`
            struct LibraryScreen: View {
                @State private var viewModel: LibraryViewModel

                var body: some View {
                    LibraryContent(state: viewModel.state)
                        .onAppear {
                            Task {   // nadie la cancela: sigue viva al salir de la pantalla
                                await viewModel.observeBooks()
                            }
                        }
                }
            }
          `, S`
            struct LibraryScreen: View {
                @State private var viewModel: LibraryViewModel

                var body: some View {
                    LibraryContent(state: viewModel.state)
                        .task {   // se cancela sola cuando la vista desaparece
                            await viewModel.observeBooks()
                        }
                }
            }
          `, {
            bad: 'Cada vez que la vista aparece se lanza otra recolección y ninguna se cancela: trabajo duplicado, fugas de memoria y estados que se pisan.',
            good: '`.task` ata la recolección al ciclo de vida de la vista. Con SKIE, cancelar la tarea también cancela la corrutina que recoge el `Flow` en Kotlin.'
          }),
          p('En el ViewModel, observar es un bucle `for await` sobre tipos Swift. El adaptador se encarga de convertir el `Flow` de Kotlin en un `AsyncStream`:'),
          tabs([
            ['ViewModel', 'swift', S`
              /// Llamar desde .task: termina cuando SwiftUI cancela la tarea.
              func observeBooks() async {
                  for await books in service.books() {
                      self.books = books
                  }
              }
            `],
            ['Adaptador', 'swift', S`
              // Flow<List<Book>> (SKIE) → AsyncStream<[BookSummary]>
              func books() -> AsyncStream<[BookSummary]> {
                  AsyncStream { continuation in
                      let task = Task {
                          for await books in container.observeBooks.invoke() {
                              continuation.yield(books.map(BookSummary.init))
                          }
                          continuation.finish()
                      }
                      continuation.onTermination = { _ in task.cancel() }
                  }
              }
            `]
          ]),
          note('tip', 'Por qué `onTermination` importa', 'Cuando SwiftUI cancela la tarea del `.task`, el `AsyncStream` termina y llama a `onTermination`. Ahí cancelamos la `Task` interna y, con SKIE, la cancelación llega a la corrutina de Kotlin. Sin esa línea, Kotlin seguiría recogiendo datos para nadie.'),
          h('StateFlow: valor actual y cambios'),
          p('Con SKIE, un `StateFlow<T>` llega como `SkieSwiftStateFlow<T>`: tiene `.value` (el valor actual) y además es una `AsyncSequence`. Si necesitas pintar algo al instante, lee `.value`; para seguir los cambios, recórrelo con `for await` igual que un `Flow`.'),
          h('Errores dentro de un Flow'),
          note('warn', 'Un Flow que lanza no es un buen contrato', 'Con SKIE, un `Flow` se recorre con `for await` (no con `for try await`): no tienes un `catch` en Swift para una excepción dentro del stream. Pide al equipo KMP que la capture dentro (`catch { emit(...) }`) y modele el error como dato, por ejemplo con un estado `Failed`. También es buena práctica en Android.'),
          h('Checklist rápida'),
          list([
            'Llama a funciones `suspend` desde métodos `async` del ViewModel; nunca bloquees esperando.',
            'Recoge Flows dentro de `.task`, o de `.task(id:)` si dependen de un parámetro.',
            'Nada de `Task` sueltas en las vistas para trabajo largo; si el ViewModel crea una, la guarda y la cancela.',
            'Convierte a tipos Swift antes de que el dato llegue al ViewModel.'
          ]),
          keys([
            '`suspend` → `async` y `Flow` → `AsyncSequence` (con SKIE o Swift export).',
            '`.task` es el ciclo de vida natural para recoger Flows: cancela al salir.',
            'Kotlin decide su hilo; tu ViewModel `@MainActor` vuelve solo al principal tras cada `await`.',
            'Los errores de un Flow, mejor como datos que como excepciones.'
          ])
        ],
        quiz: [
          q('¿Dónde recoges un Flow que alimenta una pantalla?', [
            'En el `init` del ViewModel con una `Task`',
            'En `.onAppear` con `Task { }`',
            'En `.task { await viewModel.observeBooks() }`'
          ], 2, '`.task` empieza cuando la vista aparece y se cancela cuando desaparece. Las otras dos opciones crean trabajo que nadie cancela.'),
          q('Tras `try await service.refresh()` en un ViewModel `@MainActor`, ¿necesitas `DispatchQueue.main.async` para actualizar el estado?', [
            'Sí, Kotlin devuelve el resultado en un hilo de fondo',
            'No: el método está aislado en el MainActor y se reanuda en él',
            'Solo en iOS 17'
          ], 1, 'El aislamiento lo garantiza Swift: un método `@MainActor` siempre se reanuda en el actor principal después de un `await`, venga de donde venga el resultado.'),
          q('Un `StateFlow<Int>` expuesto con SKIE…', [
            'Solo se puede leer con `for await`',
            'Tiene `.value` y además es una `AsyncSequence`',
            'No se puede usar desde Swift'
          ], 1, '`SkieSwiftStateFlow` expone el valor actual en `.value` y emite los cambios como secuencia asíncrona.')
        ]
      },

      // -----------------------------------------------------------------------
      {
        id: 'sealed-errores',
        title: 'Sealed classes, enums y errores entre lenguajes',
        level: 'Avanzado',
        minutes: 14,
        tags: ['sealed', 'onEnum', 'enum', '@Throws', 'NSError', 'kotlinException'],
        summary: 'Switch exhaustivos sobre tipos de Kotlin y una estrategia de errores que no tumba la app.',
        blocks: [
          p('En la frontera hay dos fuentes clásicas de bugs: `switch` que no son exhaustivos (y se rompen en silencio cuando Kotlin añade un caso) y excepciones de Kotlin que llegan a Swift sin estar declaradas (y cierran la app).'),
          h('Sealed classes exhaustivas con onEnum(of:)'),
          tabs([
            ['Kotlin', 'kotlin', S`
              sealed interface LibraryError {
                  data object Offline : LibraryError
                  data object NotFound : LibraryError
                  data class Server(val code: Int) : LibraryError
                  data class Unknown(val message: String) : LibraryError
              }
            `],
            ['Swift · SKIE', 'swift', S`
              extension LibraryFailure {
                  init(_ error: LibraryError) {
                      switch onEnum(of: error) {
                      case .offline: self = .offline
                      case .notFound: self = .notFound
                      case .server(let server): self = .server(code: Int(server.code))
                      case .unknown(let unknown): self = .unknown(unknown.message)
                      }
                      // Si Kotlin añade un caso, este switch deja de compilar. Justo lo que quieres.
                  }
              }
            `],
            ['Swift · sin SKIE', 'swift', S`
              extension LibraryFailure {
                  init(_ error: LibraryError) {
                      if error is LibraryErrorOffline {
                          self = .offline
                      } else if error is LibraryErrorNotFound {
                          self = .notFound
                      } else if let server = error as? LibraryErrorServer {
                          self = .server(code: Int(server.code))
                      } else if let unknown = error as? LibraryErrorUnknown {
                          self = .unknown(unknown.message)
                      } else {
                          self = .unknown("Caso nuevo sin mapear")   // el compilador no avisa
                      }
                  }
              }
            `]
          ]),
          note('kmp', 'Y los enum class', 'Con SKIE, un `enum class` de Kotlin llega como un `enum` de Swift de verdad y su `switch` es exhaustivo. Sin SKIE es una clase con propiedades estáticas y necesitas `default`. Si no usáis SKIE, mapéalo a un enum Swift en el adaptador y tendrás el mismo efecto.'),
          h('Excepciones: el crash que no ves venir'),
          p('En Kotlin todas las excepciones son *unchecked*; en Swift los errores son explícitos. El puente solo convierte en un `Error` de Swift las excepciones **declaradas con `@Throws`**. Cualquier otra que llegue a la frontera termina el proceso. En las funciones `suspend` sin `@Throws`, solo se propaga `CancellationException`.'),
          compare('kotlin', S`
            class GetBookUseCase(private val repository: BookRepository) {
                // Si el repositorio lanza una excepción de red, la app iOS se cierra
                suspend operator fun invoke(id: String): Book = repository.book(id)
            }
          `, S`
            class GetBookUseCase(private val repository: BookRepository) {
                // El repositorio traduce los errores técnicos (Ktor, SQL) a LibraryException
                @Throws(LibraryException::class, CancellationException::class)
                suspend operator fun invoke(id: String): Book = repository.book(id)
            }
          `, {
            bad: 'Sin `@Throws`, una excepción de red no es un error para Swift: es un crash. Y en Android nadie lo nota, porque allí la misma excepción se puede capturar.',
            good: 'Declara las excepciones esperadas. En funciones `suspend`, el compilador exige incluir `CancellationException` (o una superclase) en `@Throws`.'
          }),
          h('Leer la excepción de Kotlin desde Swift'),
          code('swift', S`
            extension LibraryFailure {
                /// Traduce cualquier error que salga de una llamada a KMP.
                init(_ error: any Error) {
                    let kotlin = (error as NSError).kotlinException
                    if error is CancellationError || kotlin is KotlinCancellationException {
                        self = .cancelled
                    } else if let exception = kotlin as? LibraryException {
                        self.init(exception.error)   // el init exhaustivo de arriba
                    } else {
                        self = .unknown(error.localizedDescription)
                    }
                }
            }
          `, 'LibraryFailure+Kotlin.swift'),
          p('`kotlinException` es una propiedad que el framework añade a `NSError`: guarda la excepción original de Kotlin. Con ella recuperas el error de dominio tipado sin parsear mensajes.'),
          note('tip', 'Lanza errores de dominio, no técnicos', 'Una `LibraryException(LibraryError.Offline)` es un contrato estable. Una excepción de timeout de Ktor es un detalle de implementación que mañana puede cambiar. El adaptador solo debería conocer las primeras.'),
          h('Alternativa: errores como datos'),
          p('Otra estrategia válida es que los casos de uso no lancen y devuelvan un resultado sellado, por ejemplo `sealed interface LoadResult { Success; Failure }`. Con SKIE se consume con `onEnum(of:)` y no hay excepciones que olvidar. Evita, eso sí, un contenedor genérico tipo `Outcome<T>`: en el export Obj-C los argumentos genéricos tienen que ser objetos, así que `Outcome<List<Book>>` llega como `Outcome<NSArray>` y pierdes el tipo de la lista.'),
          keys([
            'Con SKIE, `switch onEnum(of:)` hace exhaustivos los sealed: si Kotlin añade un caso, Swift no compila.',
            'Toda función pública que pueda fallar lleva `@Throws`; en `suspend`, incluye `CancellationException`.',
            'Recupera la excepción con `(error as NSError).kotlinException` y tradúcela en el adaptador.',
            'La cancelación no es un error que mostrar: trátala aparte.'
          ])
        ],
        quiz: [
          q('Un caso de uso `suspend` sin `@Throws` lanza `IllegalStateException`. ¿Qué recibe Swift?', [
            'Un `Error` que puede capturar con `catch`',
            'Nada: la excepción se ignora',
            'Nada: la app termina'
          ], 2, 'Sin `@Throws`, las funciones `suspend` solo propagan `CancellationException`. Cualquier otra excepción se considera no controlada y termina el proceso.'),
          q('¿Qué ventaja tiene `switch onEnum(of: error)` frente a una cadena de `if let … as?`?', [
            'Es más rápido en ejecución',
            'Es exhaustivo: el compilador avisa si Kotlin añade un caso',
            'Funciona sin SKIE'
          ], 1, 'SKIE genera un enum Swift con un caso por subclase. Un `switch` sin `default` sobre él deja de compilar cuando aparece un caso nuevo, que es exactamente lo que quieres.'),
          q('¿Cómo recuperas la excepción original de Kotlin dentro de un `catch` en Swift?', [
            '`error as! KotlinException`',
            '`(error as NSError).kotlinException`',
            'Leyendo el texto de `localizedDescription`'
          ], 1, 'El framework añade `kotlinException` a `NSError`. Con un `as?` obtienes el tipo de excepción concreto y su error de dominio.')
        ]
      },

      // -----------------------------------------------------------------------
      {
        id: 'capa-adaptadora',
        title: 'La capa adaptadora: tu frontera con KMP',
        level: 'Avanzado',
        minutes: 15,
        tags: ['adaptador', 'protocolos', 'Sendable', 'mapeo', 'testabilidad'],
        summary: 'Un único sitio que habla Kotlin: protocolos Swift, modelos Sendable y errores traducidos. Lo que hace tu app testeable, previsualizable y lista para Swift export.',
        blocks: [
          p('El adaptador (también llamado *anti-corruption layer*) es la pieza más rentable de una app SwiftUI sobre KMP. Es poco código y te da cuatro cosas: vistas y ViewModels solo ven tipos Swift; previews y tests funcionan con fakes sin arrancar KMP; Swift 6 deja de quejarse de tipos que no son `Sendable`; y si cambias de SKIE a Swift export, solo tocas esta capa.'),
          h('1. Define el contrato en Swift'),
          code('swift', S`
            // Model/LibraryService.swift — sin import Shared
            struct BookSummary: Identifiable, Hashable, Sendable {
                let id: String
                let title: String
                let author: String
                let year: Int
                let coverURL: URL?
                var isFavorite: Bool
            }

            enum LibraryFailure: Error, Equatable {
                case offline, notFound, cancelled
                case server(code: Int)
                case unknown(String)
            }

            protocol LibraryService: Sendable {
                func books() -> AsyncStream<[BookSummary]>
                func refresh() async throws(LibraryFailure)
                func book(id: String) async throws(LibraryFailure) -> BookSummary
                func setFavorite(_ favorite: Bool, for id: String) async throws(LibraryFailure)
                func search(_ query: String) async throws(LibraryFailure) -> [BookSummary]
            }
          `, 'Model/LibraryService.swift'),
          p('El protocolo describe lo que necesita la *pantalla*, con nombres y tipos Swift (`Int`, `URL?`, `throws(LibraryFailure)`). No es una copia uno a uno de los casos de uso de Kotlin.'),
          h('2. Implementa el adaptador con KMP'),
          code('swift', S`
            // Integration/KMPLibraryService.swift — el único fichero que habla con KMP
            import Foundation
            import Shared

            /// Invariante: LibraryContainer y sus casos de uso son inmutables y seguros
            /// entre hilos (Kotlin/Native permite compartirlos), por eso lo declaramos
            /// Sendable a mano.
            final class KMPLibraryService: LibraryService, @unchecked Sendable {
                private let container: LibraryContainer

                init(container: LibraryContainer) {
                    self.container = container
                }

                func books() -> AsyncStream<[BookSummary]> {
                    AsyncStream { continuation in
                        let task = Task {
                            for await books in container.observeBooks.invoke() {
                                continuation.yield(books.map(BookSummary.init))
                            }
                            continuation.finish()
                        }
                        continuation.onTermination = { _ in task.cancel() }
                    }
                }

                func refresh() async throws(LibraryFailure) {
                    try await translatingErrors { try await container.refreshBooks.invoke() }
                }

                func book(id: String) async throws(LibraryFailure) -> BookSummary {
                    let book = try await translatingErrors { try await container.getBook.invoke(id: id) }
                    return BookSummary(book)
                }

                // setFavorite(_:for:) y search(_:) siguen el mismo patrón

                private func translatingErrors<T>(
                    _ operation: () async throws -> T
                ) async throws(LibraryFailure) -> T {
                    do { return try await operation() } catch { throw LibraryFailure(error) }
                }
            }
          `, 'Integration/KMPLibraryService.swift'),
          h('3. Mapea en un solo sitio'),
          code('swift', S`
            // Integration/Mapping.swift
            import Foundation
            import Shared

            extension BookSummary {
                init(_ book: Book) {
                    self.init(
                        id: book.id,
                        title: book.title,
                        author: book.author,
                        year: Int(book.year),                               // Int32 → Int
                        coverURL: book.coverUrl.flatMap(URL.init(string:)), // String? → URL?
                        isFavorite: book.isFavorite
                    )
                }
            }
          `, 'Integration/Mapping.swift'),
          h('4. Un fake para previews y tests'),
          code('swift', S`
            // Preview Content/FakeLibraryService.swift
            struct FakeLibraryService: LibraryService {
                var items: [BookSummary]? = BookSummary.samples   // nil: la caché no responde
                var refreshFailure: LibraryFailure?

                func books() -> AsyncStream<[BookSummary]> {
                    AsyncStream { continuation in
                        if let items { continuation.yield(items) }
                        continuation.finish()
                    }
                }

                func refresh() async throws(LibraryFailure) {
                    if let refreshFailure { throw refreshFailure }
                }

                func book(id: String) async throws(LibraryFailure) -> BookSummary {
                    guard let book = items?.first(where: { $0.id == id }) else { throw .notFound }
                    return book
                }

                func setFavorite(_ favorite: Bool, for id: String) async throws(LibraryFailure) {}

                func search(_ query: String) async throws(LibraryFailure) -> [BookSummary] {
                    (items ?? []).filter { $0.title.localizedStandardContains(query) }
                }
            }
          `, 'Preview Content/FakeLibraryService.swift'),
          note('warn', 'Sobre ese @unchecked Sendable', 'Es una promesa al compilador y debe estar justificada. Aquí lo está: el adaptador solo guarda referencias inmutables a objetos de Kotlin que no tienen estado mutable compartido. Si algún día guardas estado mutable en el adaptador, conviértelo en `actor` o protégelo.'),
          note('kmp', '¿Y si mañana usáis Swift export?', 'Con Swift export los tipos llegarán de otra forma: `Flow` como `AsyncSequence` tipada, sealed como tipos Swift… Si todo pasa por el adaptador, la migración consiste en reescribir esta capa y sus tests, no la app.'),
          keys([
            'Protocolo Swift con lo que necesita la pantalla; modelos `struct` y `Sendable`.',
            'Solo la capa de integración hace `import Shared`.',
            'Errores traducidos a un enum Swift, con la cancelación como caso propio.',
            'El mismo protocolo sirve a un fake para previews y tests.'
          ])
        ],
        quiz: [
          q('¿Por qué el ViewModel depende de `any LibraryService` y no de `KMPLibraryService`?', [
            'Por rendimiento',
            'Para inyectar un fake en previews y tests',
            'Porque Swift no admite clases concretas en un `init`'
          ], 1, 'Depender del protocolo desacopla el ViewModel de Kotlin: en producción recibe el adaptador real y en previews o tests, un fake.'),
          q('¿Qué justifica el `@unchecked Sendable` de `KMPLibraryService`?', [
            'Nada, siempre es un error',
            'Que solo guarda referencias inmutables a casos de uso de Kotlin seguros entre hilos, y está documentado',
            'Que compila más rápido'
          ], 1, '`@unchecked` desactiva la comprobación, así que solo es aceptable con una invariante clara y escrita. En una frontera de interop con objetos inmutables, lo es.'),
          q('¿Dónde conviertes `book.year` (`Int32`) a `Int`?', [
            'En la vista, con `Int(book.year)`',
            'En el mapeo del adaptador',
            'En Kotlin, cambiando el tipo a `Long`'
          ], 1, 'El mapeo vive en un único sitio: el adaptador. Así ninguna capa por encima sabe que existe `Int32`.')
        ]
      },

      // -----------------------------------------------------------------------
      {
        id: 'dependencias',
        title: 'Dependencias, servicios de plataforma y memoria',
        level: 'Avanzado',
        minutes: 14,
        tags: ['DI', 'Koin', 'composition root', 'Keychain', 'memoria', 'ARC'],
        summary: 'Arrancar el módulo compartido, inyectar sin service locators, implementar interfaces Kotlin en Swift y evitar fugas entre ARC y el recolector de Kotlin.',
        blocks: [
          p('En Android, Koin o Hilt resuelven las dependencias. En iOS no necesitas replicar eso: basta con un **composition root** que cree el grafo una vez al arrancar y lo pase hacia abajo por inicializadores.'),
          h('Un punto de entrada en Kotlin'),
          code('kotlin', S`
            // shared/src/commonMain/kotlin/com/example/library/LibraryContainer.kt
            class LibraryContainer(
                tokenStorage: TokenStorage,   // implementado en Swift con Keychain
                baseUrl: String,
            ) {
                private val httpClient = createHttpClient(baseUrl, tokenStorage)
                private val database = createDatabase()   // expect/actual: driver nativo en iOS
                private val repository: BookRepository = DefaultBookRepository(httpClient, database)

                val observeBooks = ObserveBooksUseCase(repository)
                val refreshBooks = RefreshBooksUseCase(repository)
                val getBook = GetBookUseCase(repository)
                val setFavorite = SetFavoriteUseCase(repository)
                val searchBooks = SearchBooksUseCase(repository)
            }
          `, 'LibraryContainer.kt'),
          p('Un contenedor así (o una fachada sobre Koin, si el equipo ya lo usa) le da a Swift una API sencilla: un objeto con los casos de uso ya construidos. Nada de llamar a `get()` de Koin desde Swift: sus funciones genéricas *reified* ni siquiera se exportan.'),
          compare('swift', S`
            @MainActor
            @Observable
            final class LibraryViewModel {
                // Service locator: dependencia oculta e imposible de sustituir en tests
                private let service = KMPLibraryService(
                    container: KoinHelper.shared.libraryContainer()
                )
            }
          `, S`
            @MainActor
            final class AppDependencies {
                let library: any LibraryService

                init(library: any LibraryService) {
                    self.library = library
                }

                static func live() -> AppDependencies {
                    let container = LibraryContainer(
                        tokenStorage: KeychainTokenStorage(),
                        baseUrl: "https://api.example.com"
                    )
                    return AppDependencies(library: KMPLibraryService(container: container))
                }
            }

            @main
            struct LibraryApp: App {
                private let dependencies = AppDependencies.live()   // una vez, al arrancar

                var body: some Scene {
                    WindowGroup {
                        RootView(dependencies: dependencies)
                    }
                }
            }
          `, {
            bad: 'El ViewModel fabrica su propia dependencia: no hay forma de darle un fake, y el arranque de KMP queda escondido dentro de una pantalla.',
            good: 'El grafo se crea una sola vez en el punto de entrada de la app y baja por `init`. Cambiarlo por fakes (UI tests, previews) es cambiar una línea.'
          }),
          note('kmp', 'Si el equipo usa Koin', 'Pide una función `initKoin()` que el composition root llame una única vez y una clase fachada en Kotlin que exponga los casos de uso como propiedades. Swift no debería ver `KoinComponent` ni `get()` en ningún otro sitio.'),
          h('Servicios de plataforma: interfaces de Kotlin implementadas en Swift'),
          tabs([
            ['Kotlin (commonMain)', 'kotlin', S`
              interface TokenStorage {
                  fun read(): String?
                  fun write(token: String?)
              }
            `],
            ['Swift', 'swift', S`
              import Foundation
              import Security
              import Shared

              final class KeychainTokenStorage: TokenStorage {
                  private let base: [String: Any] = [
                      kSecClass as String: kSecClassGenericPassword,
                      kSecAttrAccount as String: "session-token"
                  ]

                  func read() -> String? {
                      var query = base
                      query[kSecReturnData as String] = true
                      var item: CFTypeRef?
                      guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
                            let data = item as? Data else { return nil }
                      return String(data: data, encoding: .utf8)
                  }

                  func write(token: String?) {
                      SecItemDelete(base as CFDictionary)
                      guard let token, let data = token.data(using: .utf8) else { return }
                      var attributes = base
                      attributes[kSecValueData as String] = data
                      attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
                      SecItemAdd(attributes as CFDictionary, nil)
                  }
              }
            `]
          ]),
          p('El dominio dice *qué* necesita (una interfaz) y cada plataforma decide *cómo* (Keychain en iOS, almacenamiento cifrado en Android). Es la alternativa a `expect`/`actual` cuando la implementación necesita APIs o librerías que es más natural usar desde Swift.'),
          h('Memoria: ARC por un lado, recolector por el otro'),
          p('Swift libera objetos contando referencias (ARC); Kotlin/Native usa un recolector de basura. El puente los integra bien en el día a día, pero hay tres situaciones que conviene vigilar:'),
          list([
            '**Ciclos que cruzan la frontera**: un objeto Swift que retiene a uno de Kotlin que, a su vez, retiene al primero (por ejemplo, a través de una closure que captura `self`). No cuentes con que nadie lo libere. Usa `[weak self]` en las closures que entregas a Kotlin.',
            '**Liberación diferida**: los objetos de Kotlin se liberan cuando pasa el recolector, no al instante. No uses `deinit` para cerrar recursos: pide métodos explícitos (`close()`, `cancel()`) y llámalos.',
            '**Trabajo que sobrevive a la pantalla**: una recolección de `Flow` sin cancelar mantiene vivo el ViewModel y todo lo que captura. Por eso importan `.task` y la cancelación propagada.'
          ]),
          compare('swift', S`
            final class SessionObserver {
                private let session: SessionManager   // clase de Kotlin
                var onExpired: (() -> Void)?

                init(session: SessionManager) {
                    self.session = session
                    session.addListener { _ in    // Kotlin guarda esta closure
                        self.onExpired?()         // captura fuerte: ciclo Swift ↔ Kotlin
                        return KotlinUnit()
                    }
                }
            }
          `, S`
            final class SessionObserver {
                private let session: SessionManager
                private var subscription: Subscription?   // Kotlin devuelve un token
                var onExpired: (() -> Void)?

                init(session: SessionManager) {
                    self.session = session
                    subscription = session.addListener { [weak self] _ in
                        self?.onExpired?()
                        return KotlinUnit()
                    }
                }

                func stop() {
                    subscription?.cancel()   // liberación explícita, sin depender de deinit
                }
            }
          `, {
            bad: 'La closure retiene a `self` y Kotlin retiene la closure. Ese ciclo cruza dos sistemas de memoria distintos: no esperes que se libere.',
            good: '`[weak self]` rompe el ciclo y el token permite darse de baja de forma explícita. Mejor todavía: que Kotlin exponga un `Flow` y lo consumas con `.task`.'
          }),
          keys([
            'Composition root: crea el grafo una vez al arrancar y pásalo por `init`.',
            'Swift no llama a Koin: pide un contenedor o una fachada con los casos de uso.',
            'APIs de plataforma: interfaz en Kotlin, implementación en Swift, inyectada al arrancar.',
            'Entre ARC y el recolector: `[weak self]`, cancelación explícita y nada de `deinit` para liberar recursos.'
          ])
        ],
        quiz: [
          q('¿Dónde se crea `LibraryContainer`?', [
            'En cada ViewModel que lo necesite',
            'Una vez, en el composition root de la app',
            'En la vista raíz, dentro de `body`'
          ], 1, 'Crear el grafo una sola vez evita duplicar clientes HTTP o bases de datos y deja un único sitio para cambiar implementaciones.'),
          q('El módulo compartido necesita guardar un token de forma segura. ¿Qué diseño encaja?', [
            'Que Kotlin lo guarde en `UserDefaults`',
            'Una interfaz `TokenStorage` en Kotlin, implementada en Swift con Keychain e inyectada en el contenedor',
            'Que la app guarde el token y se lo pase a cada caso de uso'
          ], 1, 'El dominio define la necesidad y la plataforma aporta la implementación segura. `UserDefaults` no está cifrado y pasar el token a mano reparte una responsabilidad del módulo de datos por toda la app.'),
          q('Pasas a Kotlin una closure que usa `self`. ¿Qué haces?', [
            'Nada: ARC lo resuelve',
            'Capturar `[weak self]` y ofrecer una forma explícita de cancelar la suscripción',
            'Usar siempre `unowned(unsafe)`'
          ], 1, 'Un ciclo que cruza ARC y el recolector de Kotlin no se rompe solo. `[weak self]` lo evita y la cancelación explícita libera los recursos en el momento que tú decides.')
        ]
      }
    ]
  });
})();
