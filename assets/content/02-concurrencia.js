(function () {
  'use strict';
  const { p, h, code, compare, tabs, note, list, steps, table, keys, q, S } = Curso.dsl;

  Curso.module({
    id: 'concurrencia',
    order: 2,
    title: 'Concurrencia en Swift 6',
    short: 'Concurrencia',
    icon: 'bolt',
    description: 'Swift Concurrency sin miedo: async/await, actores y Sendable, los cambios de Swift 6.2 y cómo consumir secuencias asíncronas como las que emite KMP.',
    lessons: [
      // ---------------------------------------------------------------------
      {
        id: 'async-await',
        title: 'async/await y concurrencia estructurada',
        level: 'Intermedio',
        minutes: 13,
        tags: ['async', 'await', 'async let', 'TaskGroup', 'cancelación', 'Task', 'continuation'],
        summary: 'Código asíncrono lineal, tareas en paralelo que no se escapan y cancelación cooperativa.',
        blocks: [
          p('Swift Concurrency sustituye a los *completion handlers* y a GCD por un modelo en el que el compilador entiende qué se ejecuta dónde. La palabra clave es **estructurada**: las tareas hijas no sobreviven a su padre, la cancelación se propaga hacia abajo y los errores suben por la pila, como en una función normal.'),
          h('De callbacks a async/await'),
          compare('swift', S`
            func loadDetail(id: String, completion: @escaping (Result<Detail, Error>) -> Void) {
                api.fetchBook(id: id) { bookResult in
                    switch bookResult {
                    case .failure(let error):
                        completion(.failure(error))
                    case .success(let book):
                        api.fetchReviews(bookID: id) { reviewsResult in
                            DispatchQueue.main.async {
                                completion(reviewsResult.map { Detail(book: book, reviews: $0) })
                            }
                        }
                    }
                }
            }
          `, S`
            func loadDetail(id: String) async throws -> Detail {
                async let book = api.book(id: id)
                async let reviews = api.reviews(bookID: id)
                return try await Detail(book: book, reviews: reviews)
            }
          `, {
            bad: 'Pirámide de callbacks, saltos manuales al hilo principal, peticiones en serie y es fácil olvidar llamar a `completion` en algún camino.',
            good: 'Lineal, los errores se propagan solos y las dos peticiones van **en paralelo** gracias a `async let`.'
          }),
          h('Concurrencia estructurada: `async let` y grupos'),
          p('`async let` sirve para un número fijo de tareas. Para un número variable, usa un *task group*. En ambos casos las tareas hijas terminan antes de que termine la función: si una falla, las demás se cancelan.'),
          code('swift', S`
            func covers(for books: [BookSummary]) async throws -> [String: Data] {
                try await withThrowingTaskGroup(of: (String, Data).self) { group in
                    for book in books {
                        guard let url = book.coverURL else { continue }
                        group.addTask {
                            let (data, _) = try await URLSession.shared.data(from: url)
                            return (book.id, data)
                        }
                    }

                    var result: [String: Data] = [:]
                    for try await (id, data) in group {
                        result[id] = data
                    }
                    return result
                }
            }
          `, 'Un número variable de descargas en paralelo'),
          h('Cancelación cooperativa'),
          p('Cancelar una tarea **no la detiene**: marca una bandera que el código debe consultar. Las APIs de Apple (`URLSession`, `Task.sleep`) ya lo hacen y lanzan `CancellationError`; en bucles largos sin `await`, hazlo tú.'),
          code('swift', S`
            func importAll(_ files: [URL]) async throws {
                for file in files {
                    try Task.checkCancellation()   // lanza CancellationError si nos cancelaron
                    try await importFile(file)
                }
            }

            func pollStatus() async {
                while !Task.isCancelled {          // variante sin lanzar
                    await refreshStatus()
                    try? await Task.sleep(for: .seconds(30))
                }
            }
          `),
          h('`Task { }` no estructurada: con cuidado'),
          compare('swift', S`
            struct BookDetailView: View {
                let viewModel: BookDetailViewModel

                var body: some View {
                    BookDetailContent(viewModel: viewModel)
                        .onAppear {
                            Task { await viewModel.load() }   // nadie la cancela
                        }
                }
            }
          `, S`
            struct BookDetailView: View {
                let viewModel: BookDetailViewModel

                var body: some View {
                    BookDetailContent(viewModel: viewModel)
                        .task { await viewModel.load() }      // se cancela al desaparecer
                }
            }
          `, {
            bad: 'Si el usuario sale de la pantalla, la tarea sigue viva: gasta red y puede escribir estado de una pantalla que ya no existe.',
            good: '`.task` liga la tarea a la vida de la vista y la cancela automáticamente.'
          }),
          p('Si de verdad necesitas una `Task` no estructurada (por ejemplo, desde la acción de un botón), recuerda dos cosas: **hereda el actor** del contexto donde la creas (en un ViewModel `@MainActor`, se ejecuta en el actor principal) y **no se cancela sola**. Guárdala si debes poder cancelarla.'),
          code('swift', S`
            @MainActor
            @Observable
            final class UploadViewModel {
                @ObservationIgnored private var uploadTask: Task<Void, Never>?

                func startUpload() {
                    uploadTask?.cancel()          // evita subidas duplicadas
                    uploadTask = Task {
                        await upload()            // hereda el main actor
                    }
                }

                func cancelUpload() {
                    uploadTask?.cancel()
                }

                private func upload() async {
                    // …
                }
            }
          `),
          note('warn', 'Evita `Task.detached`', '`Task.detached` no hereda actor, prioridad ni valores de tarea, y tampoco se cancela con su creador. Casi nunca es lo que quieres. Para sacar trabajo pesado del actor principal en Swift 6.2+ usa una función `@concurrent` ([Approachable Concurrency](#/l/approachable)).'),
          h('Puentes con APIs de callbacks'),
          code('swift', S`
            func authorize() async throws -> Token {
                try await withCheckedThrowingContinuation { continuation in
                    legacyAuth.authorize { result in        // Result<Token, any Error>
                        continuation.resume(with: result)    // exactamente una vez
                    }
                }
            }
          `),
          p('La regla de oro: reanuda la *continuation* **exactamente una vez** en todos los caminos. Si la olvidas, la tarea queda colgada para siempre; si la reanudas dos veces, es un error grave. La versión `Checked` te avisa en depuración. Y no mezcles mundos: dentro de código `async`, nada de `DispatchQueue` ni *completion handlers* nuevos.'),
          note('kmp', 'Las funciones `suspend` ya son `async`', 'Las funciones `suspend` del módulo compartido se llaman desde Swift con `try await`; con SKIE, además, la cancelación se propaga en los dos sentidos. No las envuelvas en continuations ni en `DispatchQueue`. Lo verás en [suspend y Flow desde SwiftUI](#/l/suspend-flow).'),
          keys([
            '`async let` para un número fijo de tareas en paralelo; *task groups* para un número variable.',
            'La cancelación es cooperativa: comprueba `Task.isCancelled` o llama a `Task.checkCancellation()` en bucles largos.',
            'En vistas, `.task` en lugar de `onAppear` + `Task { }`.',
            'Una `Task { }` hereda el actor y no se cancela sola: guárdala si debes cancelarla. Evita `Task.detached`.',
            'Las continuations se reanudan exactamente una vez.'
          ]),
        ],
        quiz: [
          q('¿Qué hace `async let`?',
            ['Ejecuta la tarea en un hilo nuevo y la olvida', 'Declara una constante que se calcula de forma perezosa en el hilo principal', 'Lanza una tarea hija en paralelo cuyo valor se espera con `await` al leerlo', 'Es lo mismo que `Task.detached`'],
            2, '`async let` crea una tarea hija estructurada que empieza enseguida; su resultado se espera con `await` cuando lo usas.'),
          q('Cancelas una tarea que está en un bucle de 10.000 iteraciones sin ningún `await`. ¿Qué pasa?',
            ['Sigue hasta terminar, salvo que el código compruebe `Task.isCancelled` o llame a `Task.checkCancellation()`', 'Se detiene inmediatamente', 'Lanza `CancellationError` en la siguiente línea automáticamente', 'La app se cierra'],
            0, 'La cancelación solo marca la tarea. Si el código nunca lo comprueba, sigue ejecutándose hasta el final.'),
          q('¿Por qué `.task { }` es preferible a `.onAppear { Task { } }`?',
            ['Es más corto, nada más', '`.task` se ejecuta en un hilo secundario', '`.onAppear` no admite código asíncrono', '`.task` cancela la tarea cuando la vista desaparece'],
            3, '`.task` liga el trabajo a la vida de la vista. La `Task` creada en `onAppear` sigue viva aunque la vista ya no exista.'),
          q('Al envolver una API de callbacks con `withCheckedThrowingContinuation`, ¿cuántas veces debes llamar a `resume`?',
            ['Al menos una vez', 'Exactamente una vez en cada camino', 'Una vez por cada callback recibido', 'Ninguna, si la función ya es `async`'],
            1, 'Cero veces deja la tarea colgada para siempre; dos veces es un error grave que la versión `Checked` detecta en depuración.'),
        ],
      },

      // ---------------------------------------------------------------------
      {
        id: 'aislamiento',
        title: '@MainActor, actores y Sendable',
        level: 'Intermedio',
        minutes: 14,
        tags: ['@MainActor', 'actor', 'Sendable', 'data race', 'Swift 6', '@preconcurrency'],
        summary: 'Cómo Swift 6 evita las data races en compilación y qué significa para tus ViewModels y para los tipos de Kotlin.',
        blocks: [
          p('Una *data race* ocurre cuando dos hilos acceden a la misma memoria a la vez y al menos uno escribe. En el modo de lenguaje Swift 6 el compilador las detecta **en compilación** gracias al aislamiento: cada dato pertenece a un dominio (el actor principal, un actor concreto o «sin aislar») y solo puede cruzar a otro dominio si es seguro, es decir, si es `Sendable`.'),
          h('Los tres dominios que vas a usar'),
          table(['Dominio', 'Para qué', 'Ejemplo'], [
            ['`@MainActor`', 'Todo lo que toca la UI: vistas, ViewModels, routers', '`@MainActor @Observable final class LibraryViewModel`'],
            ['`actor`', 'Estado mutable compartido fuera de la UI', 'Una caché de imágenes, un registro de peticiones'],
            ['`nonisolated`', 'Código sin estado mutable compartido', 'Mapeos, formateadores, structs `Sendable`'],
          ]),
          h('`@MainActor` en los ViewModels'),
          p('Marcar el ViewModel entero con `@MainActor` garantiza que sus propiedades se leen y escriben en el hilo principal, que es lo que necesita SwiftUI. Después de cada `await`, el código vuelve al actor principal: no necesitas `DispatchQueue.main.async` nunca más.'),
          compare('swift', S`
            final class LibraryViewModel: ObservableObject {
                @Published var books: [BookSummary] = []

                func refresh() {
                    catalog.fetchBooks { books in
                        DispatchQueue.main.async {
                            self.books = books      // ¿y si olvidas el salto?
                        }
                    }
                }
            }
          `, S`
            @MainActor
            @Observable
            final class LibraryViewModel {
                private(set) var books: [BookSummary] = []
                private let catalog: any BookCatalog

                init(catalog: any BookCatalog) {
                    self.catalog = catalog
                }

                func refresh() async throws {
                    books = try await catalog.books()   // tras el await, de vuelta en el main actor
                }
            }
          `, {
            bad: 'La seguridad depende de que nadie olvide el salto al hilo principal. El compilador no te protege.',
            good: 'El aislamiento lo comprueba el compilador: escribir `books` fuera del actor principal ni siquiera compila.'
          }),
          h('Actores para estado compartido'),
          code('swift', S`
            actor ImageCache {
                private var downloads: [URL: Task<Data, any Error>] = [:]

                func data(for url: URL) async throws -> Data {
                    if let running = downloads[url] {
                        return try await running.value       // reutiliza la descarga en curso
                    }
                    let download = Task {
                        let (data, _) = try await URLSession.shared.data(from: url)
                        return data
                    }
                    downloads[url] = download                // se guarda ANTES del primer await
                    return try await download.value          // (en producción, quita la entrada si falla)
                }
            }
          `),
          note('warn', 'Reentrancia: el estado puede cambiar en cada `await`', 'Mientras un método de un actor está suspendido en un `await`, el actor puede atender otras llamadas. Si en el ejemplo guardásemos solo los datos al terminar, dos peticiones de la misma URL la descargarían dos veces. No asumas que lo que leíste antes de un `await` sigue igual después: vuelve a comprobarlo o, como aquí, registra el trabajo en curso antes de suspender.'),
          h('`Sendable`: qué puede cruzar dominios'),
          list([
            'Los **structs y enums** cuyas propiedades son `Sendable` lo son automáticamente dentro del módulo (si son `public`, declara la conformancia).',
            'Una `final class` con solo propiedades `let` de tipos `Sendable` puede declararse `Sendable`.',
            'Los **actores** y los tipos aislados a un actor global (`@MainActor`) son `Sendable`.',
            '`@unchecked Sendable` desactiva la comprobación: úsalo solo con un invariante real (inmutabilidad garantizada por otro lado, un lock) y documéntalo en un comentario.'
          ]),
          note('kmp', 'Los tipos de Kotlin no son `Sendable`', 'Las clases exportadas desde KMP son clases Objective-C sin `Sendable`. En modo Swift 6, pasarlas entre el actor principal y otros contextos produce errores. La solución de fondo: que no salgan del adaptador, que las convierte en structs `Sendable` ([capa adaptadora](#/l/capa-adaptadora)). Como herramienta pragmática, `@preconcurrency import Shared` rebaja esos diagnósticos para los tipos del framework; úsalo en los ficheros del adaptador, no por toda la app.'),
          code('swift', S`
            @preconcurrency import Shared

            // Invariante: solo guarda una referencia inmutable (let) al contenedor
            // de KMP, cuyos casos de uso no tienen estado mutable y Kotlin/Native
            // permite usar desde cualquier hilo. Por eso es seguro @unchecked Sendable.
            final class KMPLibraryService: LibraryService, @unchecked Sendable {
                private let container: LibraryContainer

                init(container: LibraryContainer) {
                    self.container = container
                }

                // … los métodos traducen modelos y errores de Kotlin a tipos Swift
            }
          `, 'El adaptador: el único sitio con @unchecked, y explicado'),
          keys([
            'En modo Swift 6 las data races son errores de compilación: aprende a leer los dominios de aislamiento.',
            '`@MainActor` en vistas y ViewModels; olvídate de `DispatchQueue.main.async`.',
            'Un `actor` protege estado mutable compartido, pero es reentrante en cada `await`.',
            'Prefiere tipos `Sendable` por construcción; `@unchecked Sendable` solo con un invariante documentado.',
            'Los tipos de Kotlin se quedan en el adaptador; hacia fuera, structs `Sendable`.'
          ]),
        ],
        quiz: [
          q('¿Qué garantiza marcar un ViewModel con `@MainActor`?',
            ['Que sus métodos `async` se ejecutan en paralelo', 'Que sus métodos se ejecutan en un hilo de fondo', 'Nada: es solo documentación', 'Que su estado solo se lee y escribe en el actor principal, también después de cada `await`'],
            3, 'El aislamiento al actor principal lo comprueba el compilador, y tras cada suspensión el código se reanuda en ese mismo actor.'),
          q('Un `actor` lee `downloads[url]`, hace `await` de una descarga y después escribe en `downloads`. ¿Qué riesgo hay?',
            ['Ninguno: los actores serializan el método completo', 'Reentrancia: durante el `await` otra llamada puede modificar `downloads`', 'Un deadlock garantizado', 'Una data race entre dos hilos que escriben a la vez'],
            1, 'Los actores evitan las data races, pero no la reentrancia: en cada `await` pueden ejecutarse otras llamadas al mismo actor.'),
          q('¿Cuándo es aceptable `@unchecked Sendable`?',
            ['Cuando hay un invariante que garantiza la seguridad (inmutabilidad, un lock) y está documentado', 'Siempre que el compilador se queje', 'En todos los ViewModels', 'Nunca: no compila en Swift 6'],
            0, 'Desactiva la comprobación del compilador, así que la responsabilidad pasa a ti: debe haber un motivo real y quedar escrito.'),
          q('Tu ViewModel `@MainActor` guarda un `Book` de Kotlin en una propiedad y lo pasa a un método de un `actor` (`await cache.store(book)`). En modo Swift 6, ¿qué ocurre?',
            ['Funciona sin avisos', 'Kotlin lo copia automáticamente a un struct', 'Error de compilación: `Book` no es `Sendable` y cruzaría del actor principal a otro actor', 'Se ejecuta en el hilo de Kotlin'],
            2, 'Los tipos exportados por KMP no son `Sendable`. Conviértelos en structs Swift en el adaptador antes de que crucen dominios.'),
        ],
      },

      // ---------------------------------------------------------------------
      {
        id: 'approachable',
        title: 'Approachable Concurrency (Swift 6.2+)',
        level: 'Avanzado',
        minutes: 13,
        tags: ['Swift 6.2', 'MainActor por defecto', 'nonisolated(nonsending)', '@concurrent', 'nonisolated', 'migración'],
        summary: 'Los valores por defecto de Swift 6.2: todo en el main actor salvo que digas lo contrario, y salir de él es explícito.',
        blocks: [
          p('Swift 6 hizo imposibles las data races, pero a costa de muchos errores difíciles de entender en código que, en la práctica, siempre corría en el hilo principal. Swift 6.2 (Xcode 26) cambió los valores por defecto para que el camino fácil sea el correcto: **todo en el actor principal salvo que digas lo contrario**, y salir de él es una decisión explícita.'),
          h('Las tres piezas'),
          table(['Pieza', 'Qué cambia', 'Cómo se activa'], [
            ['Aislamiento por defecto en `MainActor` (SE-0466)', 'El código sin anotar del módulo se considera `@MainActor`', 'Ajuste *Default Actor Isolation* del target (activado en proyectos de app nuevos de Xcode 26+)'],
            ['`nonisolated(nonsending)` por defecto (SE-0461)', 'Una función `async` no aislada se ejecuta en el actor de quien la llama, en vez de saltar al pool concurrente', 'Ajuste *Approachable Concurrency* (activa varias *upcoming features*)'],
            ['`@concurrent`', 'Marca una función `async` que **sí** debe ejecutarse fuera del actor', 'Disponible en Swift 6.2+'],
          ]),
          h('Qué significa en el día a día'),
          code('swift', S`
            // Target de la app con Default Actor Isolation = MainActor

            nonisolated struct BookSummary: Identifiable, Hashable, Sendable, Decodable {
                let id: String
                let title: String
            }

            @Observable
            final class CatalogViewModel {              // @MainActor implícito
                private(set) var books: [BookSummary] = []

                func load(_ data: Data) async throws {
                    books = try await Self.decode(data)  // espera sin bloquear la UI
                }

                @concurrent
                nonisolated static func decode(_ data: Data) async throws -> [BookSummary] {
                    // Se ejecuta en el pool concurrente, fuera del main actor
                    try JSONDecoder().decode([BookSummary].self, from: data)
                }
            }
          `),
          p('Con *Default Actor Isolation = MainActor*, el ViewModel, las vistas y también tus modelos son `@MainActor` sin escribirlo. Eso simplifica la UI, pero un modelo aislado al actor principal no se puede crear ni decodificar desde otro contexto. Por eso los tipos que no son de UI (modelos, errores, mapeos, parsers, adaptadores) se marcan `nonisolated`.'),
          h('Las funciones `async` ya no saltan solas'),
          tabs([
            ['Swift 6.0 / 6.1', 'swift', S`
              nonisolated func fetchBooks() async -> [BookSummary] {
                  // …
              }

              // Dentro de un ViewModel @MainActor:
              func refresh() async {
                  // fetchBooks salta al pool concurrente:
                  // todo lo que reciba o capture debe ser Sendable
                  books = await fetchBooks()
              }
            `],
            ['Swift 6.2 + Approachable Concurrency', 'swift', S`
              nonisolated func fetchBooks() async -> [BookSummary] {
                  // …
              }

              // Dentro de un ViewModel @MainActor:
              func refresh() async {
                  // fetchBooks se ejecuta en el actor de quien llama:
                  // no cruza dominios de aislamiento
                  books = await fetchBooks()
              }
            `],
          ], 'La misma llamada, dos comportamientos'),
          p('Ojo: «ejecutarse en el actor de quien llama» significa que si esa función hace trabajo pesado **síncrono**, bloquea el hilo principal. Las esperas (`await` de red o de KMP) no bloquean nada; el cálculo intensivo sí. Para eso está `@concurrent`.'),
          note('kmp', '¿Y dónde se ejecutan las funciones `suspend` de KMP?', 'En Kotlin. Cuando haces `await` de un caso de uso, la corrutina corre en el dispatcher que elija el código Kotlin; Swift solo espera, sin bloquear. Por eso la convención *main-safe* es responsabilidad del módulo compartido: el trabajo pesado debe ir dentro de `withContext(Dispatchers.Default)` o `Dispatchers.IO`. Pídelo en la revisión de API con el equipo KMP. Lo que sí corre en tu actor es el **mapeo** a structs Swift: si es pesado (miles de elementos), muévelo a una función `@concurrent`.'),
          h('Recetas para un proyecto con KMP'),
          list([
            'Target de la app: *Default Actor Isolation = MainActor* y *Approachable Concurrency* activado (lo que trae un proyecto nuevo de Xcode 26+).',
            'Modelos Swift (`BookSummary`), errores (`LibraryFailure`) y el adaptador KMP: márcalos `nonisolated`.',
            'Trabajo de CPU pesado (decodificar, ordenar miles de elementos, procesar imágenes): funciones `@concurrent`.',
            'Paquetes SPM sin UI (dominio, red, utilidades): déjalos con el aislamiento por defecto `nonisolated`; `MainActor` por defecto tiene sentido en los módulos de UI.',
            'Decide el criterio por módulo, no por fichero, y déjalo escrito en el README del proyecto.'
          ]),
          h('Migrar un proyecto existente'),
          steps([
            'Activa el modo Swift 6 módulo a módulo, empezando por los que menos dependen de otros.',
            'Activa *Approachable Concurrency* y compila: muchos errores de `Sendable` desaparecen porque las funciones `async` ya no saltan de actor.',
            'Decide el aislamiento por defecto de cada módulo: `MainActor` para la app y los módulos de UI; `nonisolated` para dominio, red y utilidades.',
            'Busca trabajo pesado que antes salía del main actor «por accidente» y márcalo `@concurrent`.',
            'Revisa cada `@unchecked Sendable` y cada `@preconcurrency`: todos deberían llevar un comentario que explique por qué son seguros.'
          ]),
          keys([
            'Swift 6.2 hace del main actor el punto de partida: menos anotaciones y menos errores falsos.',
            'Con aislamiento por defecto en `MainActor`, marca `nonisolated` los modelos, errores y adaptadores.',
            'Las funciones `async` no aisladas se quedan en el actor de quien llama; el cálculo pesado va en funciones `@concurrent`.',
            'Las funciones `suspend` de KMP corren donde diga Kotlin: exige que sean *main-safe*.'
          ]),
        ],
        quiz: [
          q('Con *Default Actor Isolation = MainActor*, ¿qué aislamiento tiene un `struct BookSummary` sin anotar?',
            ['`@MainActor`, como el resto del código sin anotar del módulo', 'Ninguno: los structs nunca se aíslan', 'El del actor de quien lo crea', 'Se convierte en un `actor` implícito'],
            0, 'El ajuste se aplica a todo el código sin anotar del módulo, modelos incluidos. Por eso los tipos que no son de UI se marcan `nonisolated`.'),
          q('En Swift 6.2 con Approachable Concurrency, una función `nonisolated func load() async` llamada desde el main actor, ¿dónde se ejecuta?',
            ['Siempre en el pool concurrente', 'En el hilo de Kotlin', 'En el actor de quien llama: el main actor', 'En un hilo nuevo creado para ella'],
            2, 'Es el comportamiento `nonisolated(nonsending)`: la función hereda el actor de quien la llama y no cruza dominios.'),
          q('Necesitas decodificar un JSON de 5 MB sin bloquear la UI en un proyecto con Approachable Concurrency. ¿Qué haces?',
            ['Llamar a la decodificación desde `.task`', 'Usar `DispatchQueue.global().async`', 'Nada: el `await` ya lo saca del hilo principal', 'Poner la decodificación en una función `@concurrent` y marcar sus tipos `nonisolated`'],
            3, '`.task` hereda el main actor y las funciones `async` no aisladas se quedan en él. `@concurrent` es la forma explícita de enviar el trabajo al pool concurrente.'),
          q('Haces `await` de una función `suspend` de KMP desde un ViewModel `@MainActor`. ¿Qué decide en qué hilo hace Kotlin su trabajo pesado?',
            ['El actor del ViewModel', 'El dispatcher que use el código Kotlin (`withContext`)', 'La prioridad de la `Task` de Swift', 'Siempre el hilo principal'],
            1, 'La corrutina se ejecuta según los dispatchers de Kotlin. Swift solo espera sin bloquear; por eso el módulo compartido debe ser *main-safe*.'),
        ],
      },

      // ---------------------------------------------------------------------
      {
        id: 'async-sequence',
        title: 'AsyncSequence, AsyncStream y Observations',
        level: 'Intermedio',
        minutes: 12,
        tags: ['AsyncSequence', 'AsyncStream', 'for await', 'Flow', 'Observations', 'onTermination'],
        summary: 'Consumir y producir flujos de valores con for await, y el equivalente Swift de Flow y StateFlow.',
        blocks: [
          p('`AsyncSequence` es el equivalente Swift de un `Flow`: una secuencia de valores que llegan con el tiempo y que recorres con `for await`. Es como recibirás todo lo que el módulo KMP emite de forma continua: la caché local, el estado de la sesión, la conectividad.'),
          h('Consumir: `for await` dentro de `.task`'),
          code('swift', S`
            struct ConnectivityBadge: View {
                let monitor: ConnectivityMonitor
                @State private var isOnline = true

                var body: some View {
                    Label(isOnline ? "En línea" : "Sin conexión",
                          systemImage: isOnline ? "wifi" : "wifi.slash")
                        .task {
                            // Se cancela al desaparecer la vista: el bucle termina solo
                            for await status in monitor.updates() {
                                isOnline = status == .online
                            }
                        }
                }
            }
          `),
          p('El bucle termina cuando la secuencia acaba o cuando la tarea se cancela. Con `.task`, la cancelación llega sola al desaparecer la vista. Si recorres la secuencia en una `Task` propia, guárdala y cancélala tú.'),
          h('Producir: `AsyncStream.makeStream`'),
          code('swift', S`
            import Network

            final class ConnectivityMonitor: Sendable {
                enum Status: Sendable { case online, offline }

                func updates() -> AsyncStream<Status> {
                    let (stream, continuation) = AsyncStream.makeStream(
                        of: Status.self,
                        bufferingPolicy: .bufferingNewest(1)    // solo importa el último estado
                    )
                    let monitor = NWPathMonitor()
                    monitor.pathUpdateHandler = { path in
                        continuation.yield(path.status == .satisfied ? .online : .offline)
                    }
                    continuation.onTermination = { _ in
                        monitor.cancel()                        // limpieza al cancelar o terminar
                    }
                    monitor.start(queue: DispatchQueue(label: "connectivity"))  // la API exige una cola
                    return stream
                }
            }
          `, 'Puentear una API de callbacks a AsyncStream'),
          list([
            '**Limpia en `onTermination`**: se ejecuta cuando el consumidor cancela o cuando llamas a `finish()`. Ahí liberas el monitor, el listener o la suscripción.',
            '**Elige la política de buffer**: `.bufferingNewest(1)` para estados (solo importa el último); el valor por defecto, `.unbounded`, para eventos que no puedes perder.',
            '**Un consumidor por stream**: `AsyncStream` no hace *broadcast*; si dos vistas recorren el mismo stream, no reciben los mismos valores. Crea un stream por suscriptor, como hace `updates()`.',
            '**Termina el stream** con `continuation.finish()` cuando la fuente acaba; si no, el `for await` espera para siempre.'
          ]),
          h('Kotlin `Flow` frente a `AsyncSequence`'),
          table(['Kotlin', 'Swift', 'Comentario'], [
            ['`Flow<T>`', '`AsyncSequence` / `AsyncStream<T>`', 'Si cada llamada crea su propio stream, cada consumidor tiene su suscripción, como con un `Flow` frío.'],
            ['`collect { }`', '`for await valor in secuencia { }`', 'Se cancela con la tarea que la recorre.'],
            ['`StateFlow<T>`', 'Propiedad de una clase `@Observable`', 'Para el estado de pantalla no necesitas un stream: SwiftUI observa la propiedad.'],
            ['`SharedFlow` de eventos', '`AsyncStream` con un consumidor, o un callback', 'Para eventos de un solo uso (navegar, mostrar un aviso).'],
            ['`map`, `filter`', '`map`, `filter`, `compactMap` sobre `AsyncSequence`', 'Para `debounce`, `combineLatest` o `merge`, usa el paquete `swift-async-algorithms`.'],
          ]),
          h('Observar un `@Observable` fuera de SwiftUI: `Observations`'),
          p('Dentro de una vista, SwiftUI observa las propiedades que lees en `body`. Fuera de las vistas (un servicio, otro modelo, un test), Swift 6.2 añade `Observations`: una `AsyncSequence` que emite cada vez que cambian las propiedades `@Observable` que lee su closure. Requiere iOS 26+.'),
          code('swift', S`
            @available(iOS 26, *)
            @MainActor
            func logSearches(of viewModel: LibraryViewModel) async {
                let queries = Observations { viewModel.query }   // emite al cambiar 'query'
                for await query in queries where !query.isEmpty {
                    print("Búsqueda:", query)
                }
            }
          `),
          note('kmp', 'Los `Flow` de KMP son `AsyncSequence` con SKIE', 'Con SKIE, un `Flow<List<Book>>` llega como `SkieSwiftFlow<[Book]>`, que ya es una `AsyncSequence`: lo recorres con `for await` dentro de `.task` y, al cancelarse la tarea, también se cancela la recolección en Kotlin. Con Swift export (Alpha desde Kotlin 2.4) los `Flow` también se exportan como `AsyncSequence`. Detalles en [suspend y Flow desde SwiftUI](#/l/suspend-flow).'),
          keys([
            'Recorre las secuencias con `for await` dentro de `.task`: la cancelación es automática.',
            'Para puentear callbacks, `AsyncStream.makeStream` + `onTermination` para limpiar.',
            '`AsyncStream` no hace *broadcast*: un stream por consumidor.',
            'El estado de pantalla es una propiedad `@Observable`, no un stream; `Observations` (iOS 26+) lo observa fuera de las vistas.'
          ]),
        ],
        quiz: [
          q('¿Qué le pasa a un `for await` dentro de `.task` cuando la vista desaparece?',
            ['Sigue ejecutándose en segundo plano', 'Se pausa hasta que la vista vuelve', 'La tarea se cancela y el bucle termina', 'La app se cierra'],
            2, '`.task` cancela su tarea al desaparecer la vista; la secuencia deja de producir y el bucle sale.'),
          q('¿Para qué sirve `continuation.onTermination`?',
            ['Para liberar recursos cuando el consumidor cancela o el stream termina', 'Para emitir el último valor', 'Para reiniciar el stream', 'Para cambiar la política de buffer'],
            0, 'Es el sitio para cancelar el monitor, cerrar el listener o desuscribirse de la fuente.'),
          q('En Kotlin expones el estado de pantalla con `StateFlow`. ¿Cuál es el equivalente idiomático en un ViewModel SwiftUI con iOS 17+?',
            ['Un `AsyncStream` que la vista recorre', 'Un `@Published` dentro de un `ObservableObject`', 'Una variable global', 'Una propiedad de una clase `@Observable`'],
            3, 'SwiftUI observa directamente las propiedades `@Observable` que lee cada vista. `@Published` funciona, pero es la API anterior.'),
          q('Dos vistas recorren a la vez el mismo `AsyncStream`. ¿Qué ocurre?',
            ['Ambas reciben todos los valores', 'No reciben los mismos valores: `AsyncStream` no hace broadcast; crea un stream por consumidor', 'El compilador lo impide', 'La segunda recibe los valores con retraso'],
            1, '`AsyncStream` está pensado para un único consumidor. Para varios, crea un stream por suscriptor.'),
        ],
      },
    ],
  });
})();
