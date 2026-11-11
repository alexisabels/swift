(function () {
  'use strict';
  const { p, h, code, compare, tabs, note, list, steps, table, keys, q, S } = Curso.dsl;

  Curso.module({
    id: 'proyecto',
    order: 6,
    title: 'Proyecto guiado: la feature «Biblioteca»',
    short: 'Proyecto guiado',
    icon: 'compass',
    description: 'Construye de principio a fin una feature real sobre un módulo KMP: contrato, adaptador, ViewModel, vistas con previews y tests.',
    lessons: [
      // -----------------------------------------------------------------------
      {
        id: 'p1-contrato',
        title: 'Paso 1 · El contrato en KMP',
        level: 'Intermedio',
        minutes: 10,
        tags: ['contrato', 'casos de uso', '@Throws', 'revisión de API'],
        summary: 'Qué expone el módulo compartido para la feature «Biblioteca» y qué revisar antes de escribir una sola línea de Swift.',
        blocks: [
          p('Vas a construir la feature «Biblioteca» de principio a fin: una lista de libros que funciona sin conexión, con búsqueda, detalle y favoritos. El equipo KMP ya ha preparado el dominio. Tu primer trabajo es **leer el contrato** como lo leería un revisor.'),
          note('info', 'Supuestos del proyecto', 'Xcode 27, Swift 6 language mode, iOS 17+ y SKIE como puente. Las vistas y los ViewModels llevan `@MainActor` explícito. Si tu target usa *Default Actor Isolation = MainActor* (lo habitual en proyectos creados con Xcode 26 o posterior), marca como `nonisolated` los modelos y el adaptador del paso 2; lo explica [Approachable Concurrency](#l-approachable).'),
          h('El dominio'),
          code('kotlin', S`
            // shared/src/commonMain/kotlin/com/example/library/domain/
            data class Book(
                val id: String,
                val title: String,
                val author: String,
                val year: Int,
                val coverUrl: String?,
                val isFavorite: Boolean,
            )

            sealed interface LibraryError {
                data object Offline : LibraryError
                data object NotFound : LibraryError
                data class Server(val code: Int) : LibraryError
                data class Unknown(val message: String) : LibraryError
            }

            class LibraryException(val error: LibraryError) : Exception(error.toString())

            interface BookRepository {
                fun observeBooks(): Flow<List<Book>>   // caché local (SQLDelight)
                suspend fun refresh()                   // red → caché
                suspend fun book(id: String): Book
                suspend fun setFavorite(id: String, favorite: Boolean)
                suspend fun search(query: String): List<Book>
            }
          `, 'domain/Library.kt'),
          h('Los casos de uso'),
          code('kotlin', S`
            class ObserveBooksUseCase(private val repository: BookRepository) {
                operator fun invoke(): Flow<List<Book>> =
                    repository.observeBooks().map { books -> books.sortedBy { it.title } }
            }

            class RefreshBooksUseCase(private val repository: BookRepository) {
                @Throws(LibraryException::class, CancellationException::class)
                suspend operator fun invoke() = repository.refresh()
            }

            class GetBookUseCase(private val repository: BookRepository) {
                @Throws(LibraryException::class, CancellationException::class)
                suspend operator fun invoke(id: String): Book = repository.book(id)
            }

            class SetFavoriteUseCase(private val repository: BookRepository) {
                @Throws(LibraryException::class, CancellationException::class)
                suspend operator fun invoke(id: String, favorite: Boolean) =
                    repository.setFavorite(id, favorite)
            }

            class SearchBooksUseCase(private val repository: BookRepository) {
                @Throws(LibraryException::class, CancellationException::class)
                suspend operator fun invoke(query: String): List<Book> {
                    val text = query.trim()
                    return if (text.length < 2) emptyList() else repository.search(text)
                }
            }
          `, 'domain/UseCases.kt'),
          p('Fíjate en dos reglas de negocio: la lista llega **ordenada por título** y la búsqueda **ignora textos de menos de dos letras**. Viven en Kotlin y valen para Android e iOS. Tu código Swift no debe repetirlas.'),
          h('El punto de entrada para Swift'),
          code('kotlin', S`
            interface TokenStorage {          // lo implementa iOS con Keychain
                fun read(): String?
                fun write(token: String?)
            }

            class LibraryContainer(tokenStorage: TokenStorage, baseUrl: String) {
                private val repository: BookRepository = DefaultBookRepository(
                    api = BooksApi(createHttpClient(baseUrl, tokenStorage)),
                    dao = BookDao(createDatabase()),
                )

                val observeBooks = ObserveBooksUseCase(repository)
                val refreshBooks = RefreshBooksUseCase(repository)
                val getBook = GetBookUseCase(repository)
                val setFavorite = SetFavoriteUseCase(repository)
                val searchBooks = SearchBooksUseCase(repository)
            }
          `, 'LibraryContainer.kt'),
          h('Revisión del contrato'),
          table(['Comprobación', 'Estado', 'Por qué importa'], [
            ['Las funciones `suspend` públicas llevan `@Throws` con `CancellationException`', 'Bien', 'Sin ello, un fallo de red cerraría la app iOS.'],
            ['Los errores son una `sealed interface`', 'Bien', 'Swift podrá hacer un `switch` exhaustivo con `onEnum(of:)`.'],
            ['Ningún nombre choca con Swift (`Task`, `Result`, `Error`)', 'Bien', 'No habrá que calificar tipos en la app.'],
            ['Sin parámetros por defecto ni genéricos en la API pública', 'Bien', 'No existen en el export Objective-C.'],
            ['Reglas de negocio en Kotlin (orden, búsqueda mínima)', 'Bien', 'Una sola implementación para las dos plataformas.'],
            ['`year: Int` llegará como `Int32`', 'A vigilar', 'Lo convertimos a `Int` en el adaptador.']
          ]),
          note('kmp', 'Pide los cambios aquí, no después', 'Ajustar la API pública de Kotlin cuesta muy poco antes de que existan dos consumidores. Revisa la cabecera generada (o el Swift que genera SKIE) en la misma PR del módulo compartido.'),
          keys([
            'Lee el contrato de KMP como un revisor antes de escribir Swift.',
            'Comprueba `@Throws`, errores sellados, nombres y tipos numéricos.',
            'Las reglas de negocio (orden, validaciones) se quedan en Kotlin.',
            'Un contenedor con los casos de uso ya construidos simplifica el arranque desde Swift.'
          ])
        ],
        quiz: [
          q('La búsqueda debe ignorar textos de menos de dos letras. ¿Dónde vive esa regla?', [
            'En el ViewModel de iOS y en el de Android',
            'En `SearchBooksUseCase`, en Kotlin',
            'En la vista, deshabilitando el buscador'
          ], 1, 'Es una regla de negocio común a las dos plataformas: vive una sola vez en el caso de uso compartido.'),
          q('¿Qué comprobación evita que un fallo de red cierre la app iOS?', [
            'Que los casos de uso sean `operator fun invoke`',
            'Que las funciones `suspend` públicas declaren `@Throws` con las excepciones esperadas',
            'Que el repositorio use `Dispatchers.IO`'
          ], 1, 'Solo las excepciones declaradas en `@Throws` llegan a Swift como `Error`. El resto termina el proceso.'),
          q('`Book.year` es `Int` en Kotlin. ¿Cómo lo verás en Swift con el export por defecto?', ['`Int`', '`Int32`', '`Int64`', '`NSNumber`'], 1,
            'El `Int` de Kotlin es de 32 bits y llega como `Int32`. Lo convertirás en el adaptador.')
        ]
      },

      // -----------------------------------------------------------------------
      {
        id: 'p2-adaptador',
        title: 'Paso 2 · El adaptador Swift',
        level: 'Avanzado',
        minutes: 14,
        tags: ['adaptador', 'Sendable', 'typed throws', 'AsyncStream'],
        summary: 'Contrato Swift, modelos Sendable, traducción de errores y el puente de Flow a AsyncStream: el único sitio de la app que importa Shared.',
        blocks: [
          p('Con el contrato revisado, construyes la frontera. Si quieres el porqué de cada decisión, está en [La capa adaptadora](#l-capa-adaptadora); aquí montas los ficheros completos del proyecto.'),
          h('Estructura de carpetas'),
          code('text', S`
            LibraryApp/
            ├── App/              LibraryApp.swift · AppDependencies.swift · RootView.swift
            ├── Model/            BookSummary.swift · LibraryFailure.swift · LibraryService.swift
            ├── Integration/      KMPLibraryService.swift · LibraryFailure+Kotlin.swift
            │                     Mapping.swift · KeychainTokenStorage.swift
            ├── Features/
            │   ├── Library/      LibraryScreen.swift · LibraryContent.swift · LibraryViewModel.swift
            │   └── BookDetail/   BookDetailScreen.swift · BookDetailViewModel.swift
            └── Preview Content/  FakeLibraryService.swift · BookSummary+Samples.swift
          `, 'Estructura'),
          p('Solo `Integration/` y `App/AppDependencies.swift` hacen `import Shared`. Si un día aparece en `Features/`, algo se ha colado.'),
          h('Model: tipos Swift puros'),
          code('swift', S`
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
          `, 'Model/'),
          note('tip', 'Por qué typed throws aquí', 'El protocolo es la frontera: con `throws(LibraryFailure)` el ViewModel recibe un error de un tipo cerrado y su `switch` es exhaustivo. Dentro del adaptador seguimos usando `throws` normal, que es lo que devuelve Kotlin.'),
          h('Integration: el adaptador completo'),
          code('swift', S`
            import Foundation
            import Shared

            /// Invariante: LibraryContainer y sus casos de uso son inmutables y seguros
            /// entre hilos, así que el adaptador puede ser Sendable.
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

                func setFavorite(_ favorite: Bool, for id: String) async throws(LibraryFailure) {
                    try await translatingErrors {
                        try await container.setFavorite.invoke(id: id, favorite: favorite)
                    }
                }

                func search(_ query: String) async throws(LibraryFailure) -> [BookSummary] {
                    let books = try await translatingErrors { try await container.searchBooks.invoke(query: query) }
                    return books.map(BookSummary.init)
                }

                private func translatingErrors<T>(
                    _ operation: () async throws -> T
                ) async throws(LibraryFailure) -> T {
                    do { return try await operation() } catch { throw LibraryFailure(error) }
                }
            }
          `, 'Integration/KMPLibraryService.swift'),
          h('Traducción de errores y de modelos'),
          tabs([
            ['LibraryFailure+Kotlin.swift', 'swift', S`
              import Foundation
              import Shared

              extension LibraryFailure {
                  init(_ error: any Error) {
                      let kotlin = (error as NSError).kotlinException
                      if error is CancellationError || kotlin is KotlinCancellationException {
                          self = .cancelled
                      } else if let exception = kotlin as? LibraryException {
                          self.init(exception.error)
                      } else {
                          self = .unknown(error.localizedDescription)
                      }
                  }

                  init(_ error: LibraryError) {
                      switch onEnum(of: error) {
                      case .offline: self = .offline
                      case .notFound: self = .notFound
                      case .server(let server): self = .server(code: Int(server.code))
                      case .unknown(let unknown): self = .unknown(unknown.message)
                      }
                  }
              }
            `],
            ['Mapping.swift', 'swift', S`
              import Foundation
              import Shared

              extension BookSummary {
                  init(_ book: Book) {
                      self.init(
                          id: book.id,
                          title: book.title,
                          author: book.author,
                          year: Int(book.year),
                          coverURL: book.coverUrl.flatMap(URL.init(string:)),
                          isFavorite: book.isFavorite
                      )
                  }
              }
            `]
          ]),
          h('Composition root'),
          code('swift', S`
            import Shared

            @MainActor
            final class AppDependencies {
                let library: any LibraryService

                init(library: any LibraryService) {
                    self.library = library
                }

                static func live() -> AppDependencies {
                    let container = LibraryContainer(
                        tokenStorage: KeychainTokenStorage(),   // ver lección de dependencias
                        baseUrl: "https://api.example.com"
                    )
                    return AppDependencies(library: KMPLibraryService(container: container))
                }

                static func preview(_ service: any LibraryService = FakeLibraryService()) -> AppDependencies {
                    AppDependencies(library: service)
                }
            }
          `, 'App/AppDependencies.swift'),
          note('warn', 'Dos trampas habituales', 'Uno: olvidar `continuation.onTermination`, y Kotlin sigue recogiendo el Flow para nadie. Dos: dejar que un tipo de Kotlin «se escape» en el protocolo (por ejemplo, `func books() -> [Book]`). Si lo ves en una PR, pide un tipo Swift.'),
          keys([
            'El protocolo usa tipos Swift y `throws(LibraryFailure)`; el adaptador traduce todo lo de Kotlin.',
            '`translatingErrors` concentra la traducción de errores en un único punto.',
            '`onTermination` cancela la recolección del Flow cuando nadie escucha.',
            'El composition root crea el contenedor de Kotlin una vez y ofrece una variante para previews.'
          ])
        ],
        quiz: [
          q('¿Qué hace `continuation.onTermination = { _ in task.cancel() }` en `books()`?', [
            'Reinicia el Flow si falla',
            'Cancela la recolección del Flow de Kotlin cuando el consumidor deja de escuchar',
            'Evita que el stream emita valores repetidos'
          ], 1, 'Cuando SwiftUI cancela el `.task` que consume el stream, `onTermination` cancela la `Task` interna y, con SKIE, la corrutina de Kotlin.'),
          q('El ViewModel recibe `LibraryFailure.cancelled`. ¿Qué debería hacer?', [
            'Mostrar una alerta de error',
            'Ignorarlo: la tarea se canceló porque ya no hacía falta',
            'Reintentar la llamada automáticamente'
          ], 1, 'La cancelación es un final normal (la vista desapareció o el usuario siguió escribiendo). No es un fallo que haya que enseñar.'),
          q('¿Qué ficheros de la app importan `Shared`?', [
            'Todos los de `Features/`',
            'Los de `Integration/` y el composition root',
            'Solo `LibraryApp.swift`'
          ], 1, 'La frontera con Kotlin está acotada: el adaptador, sus mapeos y el sitio donde se construye el contenedor.')
        ]
      },

      // -----------------------------------------------------------------------
      {
        id: 'p3-viewmodel',
        title: 'Paso 3 · El ViewModel',
        level: 'Avanzado',
        minutes: 15,
        tags: ['@Observable', '@MainActor', 'estado', 'debounce', 'optimistic UI'],
        summary: 'Estado derivado sin combinaciones imposibles, observación de la caché, refresco, búsqueda con antirrebote y favoritos optimistas.',
        blocks: [
          p('El ViewModel convierte lo que ofrece el servicio en estado de pantalla. Es `@MainActor` (toca la UI) y `@Observable` (SwiftUI se entera de los cambios sin `@Published`).'),
          h('Estado derivado'),
          code('swift', S`
            import Foundation
            import Observation

            @MainActor
            @Observable
            final class LibraryViewModel {
                enum State: Equatable {
                    case loading
                    case loaded([BookSummary])
                    case empty
                    case failed(LibraryFailure)
                }

                var query = ""
                private(set) var searchResults: [BookSummary]?   // nil: no hay búsqueda activa
                private(set) var failure: LibraryFailure?        // último error
                private var books: [BookSummary]?                // nil: la caché aún no ha respondido
                @ObservationIgnored private var hasStarted = false

                private let service: any LibraryService
                private let debounce: Duration

                init(service: any LibraryService, debounce: Duration = .milliseconds(300)) {
                    self.service = service
                    self.debounce = debounce
                }

                var state: State {
                    if let books, !books.isEmpty { return .loaded(books) }
                    if let failure { return .failed(failure) }
                    return books == nil ? .loading : .empty
                }

                /// Error que se muestra como aviso cuando ya hay datos en pantalla.
                var banner: LibraryFailure? {
                    guard case .loaded = state else { return nil }
                    return failure
                }
            }
          `, 'LibraryViewModel.swift'),
          p('`state` se **calcula** a partir de dos datos independientes: lo que dice la caché (`books`) y el último error (`failure`). Así da igual en qué orden lleguen: si hay libros, se ven; si no los hay y algo falló, se ve el error. Guardar `state` a mano te obligaría a coordinar a mano ese orden.'),
          note('tip', 'Observation hace el resto', 'SwiftUI registra qué propiedades lee `body` a través de `state` y `banner` (aquí `books` y `failure`) y solo vuelve a pintar cuando cambian. `hasStarted` no afecta a la UI, por eso lleva `@ObservationIgnored`.'),
          h('Arrancar, observar y refrescar'),
          code('swift', S`
            extension LibraryViewModel {
                /// Punto de entrada desde .task: observa la caché mientras la vista viva
                /// y, la primera vez, pide datos frescos a la red en paralelo.
                func start() async {
                    let shouldRefresh = !hasStarted
                    hasStarted = true
                    await withDiscardingTaskGroup { group in
                        group.addTask { await self.observeBooks() }
                        if shouldRefresh {
                            group.addTask { await self.refresh() }
                        }
                    }
                }

                func observeBooks() async {
                    for await books in service.books() {
                        self.books = books
                    }
                }

                func refresh() async {
                    do throws(LibraryFailure) {
                        try await service.refresh()
                        failure = nil
                    } catch {
                        if error != .cancelled { failure = error }
                    }
                }
            }
          `, 'LibraryViewModel.swift (continuación)'),
          note('kmp', 'La caché manda', 'El refresco no devuelve libros: escribe en la base de datos de KMP, y el Flow de `observeBooks` emite la lista nueva. Es el patrón *offline-first*: la base de datos es la única fuente de verdad, también en iOS.'),
          h('Búsqueda con antirrebote, sin Combine'),
          code('swift', S`
            extension LibraryViewModel {
                /// Llamar desde .task(id: query): SwiftUI cancela la búsqueda anterior cada
                /// vez que cambia el texto, así que esperar debounce hace de antirrebote.
                func search() async {
                    let text = query
                    guard !text.isEmpty else {
                        searchResults = nil
                        return
                    }
                    do {
                        try await Task.sleep(for: debounce)
                    } catch {
                        return   // cancelada: el usuario sigue escribiendo
                    }
                    do throws(LibraryFailure) {
                        searchResults = try await service.search(text)
                    } catch {
                        if error != .cancelled { failure = error }
                    }
                }
            }
          `, 'LibraryViewModel.swift (continuación)'),
          p('No hay comprobación de longitud mínima: esa regla está en `SearchBooksUseCase`. Y el `debounce` se inyecta para que los tests puedan usar `.zero`.'),
          h('Favoritos optimistas'),
          code('swift', S`
            extension LibraryViewModel {
                func toggleFavorite(_ book: BookSummary) async {
                    let newValue = !book.isFavorite
                    markFavorite(newValue, for: book.id)          // la UI responde al instante
                    do throws(LibraryFailure) {
                        try await service.setFavorite(newValue, for: book.id)
                    } catch {
                        markFavorite(!newValue, for: book.id)     // si falla, se revierte
                        if error != .cancelled { failure = error }
                    }
                }

                private func markFavorite(_ value: Bool, for id: BookSummary.ID) {
                    if let index = books?.firstIndex(where: { $0.id == id }) {
                        books?[index].isFavorite = value
                    }
                    if let index = searchResults?.firstIndex(where: { $0.id == id }) {
                        searchResults?[index].isFavorite = value
                    }
                }
            }
          `, 'LibraryViewModel.swift (continuación)'),
          h('El detalle'),
          code('swift', S`
            @MainActor
            @Observable
            final class BookDetailViewModel {
                enum State: Equatable {
                    case loading
                    case loaded(BookSummary)
                    case failed(LibraryFailure)
                }

                private(set) var state: State = .loading
                private let id: String
                private let service: any LibraryService

                init(id: String, service: any LibraryService) {
                    self.id = id
                    self.service = service
                }

                func load() async {
                    do throws(LibraryFailure) {
                        let book = try await service.book(id: id)
                        state = .loaded(book)
                    } catch {
                        if error != .cancelled { state = .failed(error) }
                    }
                }
            }
          `, 'BookDetailViewModel.swift'),
          keys([
            'Deriva `state` de datos independientes en lugar de guardarlo a mano.',
            '`start()` usa un task group: observa la caché y refresca en paralelo, y todo se cancela junto.',
            'Antirrebote con `.task(id:)` y `Task.sleep`: sin Combine y fácil de testear.',
            'UI optimista: cambia ya, revierte si falla; la caché de KMP acaba confirmando el valor.'
          ])
        ],
        quiz: [
          q('¿Por qué `state` es una propiedad calculada y no un `var` que se asigna?', [
            'Porque `@Observable` no permite enums almacenados',
            'Para que el resultado no dependa del orden en que llegan la caché y el error',
            'Por rendimiento'
          ], 1, 'Caché y red responden en paralelo. Derivar el estado de `books` y `failure` evita combinaciones imposibles y condiciones de carrera.'),
          q('¿Qué hace de antirrebote en la búsqueda?', [
            'Un `Timer` en el ViewModel',
            'El `Task.sleep` dentro de una tarea que `.task(id: query)` cancela cuando cambia el texto',
            'Un `debounce` de Combine'
          ], 1, 'Cada pulsación cambia `query`, SwiftUI cancela la tarea anterior y su `sleep` lanza `CancellationError`. Solo la última sobrevive a la espera.'),
          q('El usuario marca un favorito sin conexión. ¿Qué ve?', [
            'La estrella no cambia hasta que vuelve la red',
            'La estrella cambia al instante, vuelve a su estado al fallar y aparece un aviso',
            'La app muestra la pantalla de error completa'
          ], 1, 'Es una actualización optimista: se aplica ya, se revierte si el servicio falla y el error va al aviso porque hay datos en pantalla.')
        ]
      },

      // -----------------------------------------------------------------------
      {
        id: 'p4-vistas',
        title: 'Paso 4 · Vistas, navegación y previews',
        level: 'Intermedio',
        minutes: 15,
        tags: ['SwiftUI', 'NavigationStack', 'ContentUnavailableView', '#Preview', 'accesibilidad'],
        summary: 'Pantallas que solo pintan estado, una vista de contenido sin dependencias, navegación tipada y una preview por cada estado.',
        blocks: [
          p('La pantalla tiene dos piezas: `LibraryScreen` conecta el ViewModel con SwiftUI (tareas, búsqueda, refresco) y `LibraryContent` solo pinta un estado. La segunda no sabe nada de servicios y sus parámetros opcionales tienen valor por defecto, así que se previsualiza con una línea: `LibraryContent(state: .empty)`.'),
          h('La pantalla'),
          code('swift', S`
            import SwiftUI

            struct LibraryScreen: View {
                @State private var viewModel: LibraryViewModel

                init(service: any LibraryService) {
                    _viewModel = State(initialValue: LibraryViewModel(service: service))
                }

                var body: some View {
                    LibraryContent(
                        state: viewModel.state,
                        searchResults: viewModel.searchResults,
                        query: viewModel.query,
                        onRetry: { Task { await viewModel.refresh() } },
                        onToggleFavorite: { book in Task { await viewModel.toggleFavorite(book) } }
                    )
                    .navigationTitle("Biblioteca")
                    .searchable(text: $viewModel.query, prompt: "Título o autor")
                    .task { await viewModel.start() }
                    .task(id: viewModel.query) { await viewModel.search() }
                    .refreshable { await viewModel.refresh() }
                    .safeAreaInset(edge: .bottom) {
                        if let banner = viewModel.banner {
                            BannerView(failure: banner)
                        }
                    }
                }
            }
          `, 'Features/Library/LibraryScreen.swift'),
          note('info', 'Task { } desde un botón', 'Las acciones de un botón son síncronas. Para una acción corta que inicia el usuario (reintentar, marcar favorito), `Task { }` es el puente correcto. El trabajo ligado a la vida de la pantalla va en `.task`.'),
          h('El contenido, sin dependencias'),
          code('swift', S`
            struct LibraryContent: View {
                let state: LibraryViewModel.State
                var searchResults: [BookSummary]? = nil
                var query = ""
                var onRetry: () -> Void = {}
                var onToggleFavorite: (BookSummary) -> Void = { _ in }

                var body: some View {
                    switch state {
                    case .loading:
                        ProgressView()
                    case .empty:
                        ContentUnavailableView(
                            "Aún no hay libros",
                            systemImage: "books.vertical",
                            description: Text("Desliza hacia abajo para actualizar.")
                        )
                    case .failed(let failure):
                        ContentUnavailableView {
                            Label(failure.title, systemImage: "wifi.exclamationmark")
                        } description: {
                            Text(failure.message)
                        } actions: {
                            Button("Reintentar", action: onRetry)
                        }
                    case .loaded(let books):
                        if let searchResults, searchResults.isEmpty {
                            ContentUnavailableView.search(text: query)
                        } else {
                            BookList(books: searchResults ?? books, onToggleFavorite: onToggleFavorite)
                        }
                    }
                }
            }
          `, 'Features/Library/LibraryContent.swift'),
          h('Lista y fila accesibles'),
          code('swift', S`
            struct BookList: View {
                let books: [BookSummary]
                let onToggleFavorite: (BookSummary) -> Void

                var body: some View {
                    List(books) { book in
                        NavigationLink(value: Route.book(id: book.id)) {
                            BookRow(book: book)
                        }
                        .swipeActions {
                            Button {
                                onToggleFavorite(book)
                            } label: {
                                if book.isFavorite {
                                    Label("Quitar de favoritos", systemImage: "star.slash")
                                } else {
                                    Label("Favorito", systemImage: "star")
                                }
                            }
                            .tint(.yellow)
                        }
                    }
                }
            }

            struct BookRow: View {
                let book: BookSummary

                var body: some View {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(book.title).font(.headline)
                            // grouping(.never): el año se lee «1967», nunca «1.967»
                            Text("\(book.author) · \(book.year.formatted(.number.grouping(.never)))")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if book.isFavorite {
                            Image(systemName: "star.fill")
                                .foregroundStyle(.yellow)
                                .accessibilityLabel("Favorito")
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
            }
          `, 'Features/Library/BookList.swift'),
          h('Textos de error y aviso'),
          code('swift', S`
            extension LibraryFailure {
                var title: String {
                    switch self {
                    case .offline: String(localized: "Sin conexión")
                    case .notFound: String(localized: "No encontrado")
                    case .server: String(localized: "El servidor no responde")
                    case .unknown, .cancelled: String(localized: "Algo ha fallado")
                    }
                }

                var message: String {
                    switch self {
                    case .offline: String(localized: "Revisa tu conexión y vuelve a intentarlo.")
                    case .notFound: String(localized: "Puede que este libro ya no esté disponible.")
                    case .server(let code): String(localized: "Inténtalo dentro de un rato (código \(code)).")
                    case .unknown, .cancelled: String(localized: "Inténtalo de nuevo más tarde.")
                    }
                }
            }

            struct BannerView: View {
                let failure: LibraryFailure

                var body: some View {
                    Label(failure.title, systemImage: "exclamationmark.triangle.fill")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(.regularMaterial, in: .capsule)
                        .padding(.bottom, 8)
                }
            }
          `, 'Features/Library/LibraryFailure+Text.swift'),
          p('Los textos visibles viven en Swift y pasan por el String Catalog. El dominio de Kotlin solo dice *qué* falló.'),
          h('Navegación tipada'),
          code('swift', S`
            enum Route: Hashable {
                case book(id: String)
            }

            @MainActor
            @Observable
            final class Router {
                var path: [Route] = []
            }

            struct RootView: View {
                let dependencies: AppDependencies
                @State private var router = Router()

                var body: some View {
                    NavigationStack(path: $router.path) {
                        LibraryScreen(service: dependencies.library)
                            .navigationDestination(for: Route.self) { route in
                                switch route {
                                case .book(let id):
                                    BookDetailScreen(id: id, service: dependencies.library)
                                }
                            }
                    }
                    .environment(router)
                }
            }

            struct BookDetailScreen: View {
                @State private var viewModel: BookDetailViewModel

                init(id: String, service: any LibraryService) {
                    _viewModel = State(initialValue: BookDetailViewModel(id: id, service: service))
                }

                var body: some View {
                    Group {
                        switch viewModel.state {
                        case .loading:
                            ProgressView()
                        case .failed(let failure):
                            ContentUnavailableView(failure.title, systemImage: "exclamationmark.triangle",
                                                   description: Text(failure.message))
                        case .loaded(let book):
                            List {
                                LabeledContent("Autor", value: book.author)
                                LabeledContent("Año", value: book.year.formatted(.number.grouping(.never)))
                            }
                            .navigationTitle(book.title)
                        }
                    }
                    .task { await viewModel.load() }
                }
            }
          `, 'App/RootView.swift'),
          note('tip', 'La ruta lleva un id, no un objeto', '`Route.book(id:)` es `Hashable` y barato. El detalle carga el libro con su propio ViewModel, así que un deep link (`onOpenURL` → `router.path = [.book(id: …)]`) funciona igual que un toque en la lista.'),
          h('Una preview por estado'),
          code('swift', S`
            #Preview("Con libros") {
                NavigationStack { LibraryScreen(service: FakeLibraryService()) }
            }

            #Preview("Vacía") {
                NavigationStack { LibraryScreen(service: FakeLibraryService(items: [])) }
            }

            #Preview("Sin conexión") {
                NavigationStack {
                    LibraryScreen(service: FakeLibraryService(items: [], refreshFailure: .offline))
                }
            }

            #Preview("Aviso con datos") {
                NavigationStack {
                    LibraryScreen(service: FakeLibraryService(refreshFailure: .server(code: 503)))
                }
            }

            #Preview("Contenido · error, sin ViewModel") {
                LibraryContent(state: .failed(.offline))
            }
          `, 'Features/Library/LibraryScreen+Previews.swift'),
          code('swift', S`
            struct FakeLibraryService: LibraryService {
                var items: [BookSummary]? = BookSummary.samples   // nil: la caché nunca responde
                var refreshFailure: LibraryFailure?
                var favoriteFailure: LibraryFailure?

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

                func setFavorite(_ favorite: Bool, for id: String) async throws(LibraryFailure) {
                    if let favoriteFailure { throw favoriteFailure }
                }

                func search(_ query: String) async throws(LibraryFailure) -> [BookSummary] {
                    (items ?? []).filter { $0.title.localizedStandardContains(query) }
                }
            }

            extension BookSummary {
                static let samples: [BookSummary] = [
                    BookSummary(id: "1", title: "Cien años de soledad", author: "Gabriel García Márquez",
                                year: 1967, coverURL: nil, isFavorite: true),
                    BookSummary(id: "2", title: "La sombra del viento", author: "Carlos Ruiz Zafón",
                                year: 2001, coverURL: nil, isFavorite: false),
                    BookSummary(id: "3", title: "Nada", author: "Carmen Laforet",
                                year: 1945, coverURL: nil, isFavorite: false)
                ]
            }
          `, 'Preview Content/FakeLibraryService.swift'),
          keys([
            'Separa la pantalla (conecta el ViewModel) del contenido (pinta un estado sin dependencias).',
            '`ContentUnavailableView` cubre vacío, error y búsqueda sin resultados.',
            'Las rutas llevan ids `Hashable`; cada destino carga sus datos.',
            'Una preview por estado, con el fake: ninguna arranca KMP.'
          ])
        ],
        quiz: [
          q('¿Qué ventaja tiene sacar `LibraryContent` de `LibraryScreen`?', [
            'SwiftUI la pinta más rápido',
            'Se puede previsualizar y reutilizar con cualquier estado sin crear ViewModel ni servicio',
            'Evita tener que usar `@State`'
          ], 1, 'Una vista que recibe estado y closures es una función pura de sus datos: la previsualizas con `.failed(.offline)` en una línea.'),
          q('¿Por qué `Text("\\(book.author) · \\(book.year.formatted(.number.grouping(.never)))")` en lugar de interpolar `book.year` sin más?', [
            'Porque `Int` no se puede interpolar en `Text`',
            'Porque al interpolar un número en `Text` se formatea según el idioma y un año podría salir con separador de miles',
            'Por rendimiento'
          ], 1, 'Los números interpolados en un `Text` localizado se formatean con la configuración regional; con agrupación, 2001 puede aparecer como «2,001». Para un año, desactívala.'),
          q('El usuario abre un deep link a un libro. ¿Qué haces?', [
            'Crear el `BookSummary` en `onOpenURL` y pasarlo por la ruta',
            'Añadir `.book(id:)` al `path` del Router: el detalle carga el libro por su id',
            'Abrir una hoja con un `WebView`'
          ], 1, 'Las rutas son identificadores. La pantalla de destino tiene su propio ViewModel para cargar los datos, así que el flujo es idéntico venga de donde venga.')
        ]
      },

      // -----------------------------------------------------------------------
      {
        id: 'p5-tests',
        title: 'Paso 5 · Tests y revisión final',
        level: 'Intermedio',
        minutes: 12,
        tags: ['Swift Testing', 'commonTest', 'fakes', 'revisión'],
        summary: 'Tests del ViewModel con el fake, tests de la traducción de errores con tipos reales de Kotlin y la revisión final de la feature.',
        blocks: [
          p('La feature está montada. Antes de abrir la PR, la cubres con tests en los dos lados de la frontera: las reglas de negocio en Kotlin y la presentación en Swift.'),
          h('Qué se prueba en cada lado'),
          table(['Qué', 'Dónde', 'Con qué'], [
            ['Reglas de negocio (orden, búsqueda mínima)', 'Kotlin, `commonTest`', 'Repositorio fake + `runTest`'],
            ['Traducción de errores y modelos', 'Swift, tests de la app', 'Tipos reales de Kotlin creados en Swift'],
            ['Transiciones de estado del ViewModel', 'Swift, tests de la app', '`FakeLibraryService`'],
            ['Aspecto de cada estado', 'Previews (y snapshots si los usáis)', '`LibraryContent` con estados sueltos']
          ]),
          h('Kotlin: la regla vive y se prueba una vez'),
          code('kotlin', S`
            class SearchBooksUseCaseTest {
                private val repository = FakeBookRepository()
                private val search = SearchBooksUseCase(repository)

                @Test
                fun ignoresQueriesShorterThanTwoCharacters() = runTest {
                    assertEquals(emptyList(), search(" a "))
                    assertEquals(0, repository.searchCalls)
                }

                @Test
                fun trimsTheQueryBeforeSearching() = runTest {
                    search("  dune  ")
                    assertEquals("dune", repository.lastQuery)
                }
            }
          `, 'shared/src/commonTest/.../SearchBooksUseCaseTest.kt'),
          h('Swift: el ViewModel con el fake'),
          code('swift', S`
            import Testing
            @testable import LibraryApp

            @MainActor
            @Suite("LibraryViewModel")
            struct LibraryViewModelTests {

                @Test("Muestra los libros que emite la caché")
                func showsCachedBooks() async {
                    let viewModel = LibraryViewModel(service: FakeLibraryService())
                    await viewModel.start()
                    #expect(viewModel.state == .loaded(BookSummary.samples))
                }

                @Test("Sin datos, un fallo de refresco ocupa la pantalla",
                      arguments: [LibraryFailure.offline, .notFound, .server(code: 503)])
                func showsFailureWithoutData(failure: LibraryFailure) async {
                    let service = FakeLibraryService(items: [], refreshFailure: failure)
                    let viewModel = LibraryViewModel(service: service)
                    await viewModel.start()
                    #expect(viewModel.state == .failed(failure))
                    #expect(viewModel.banner == nil)
                }

                @Test("Con datos, un fallo de refresco solo muestra un aviso")
                func showsBannerWithData() async {
                    let viewModel = LibraryViewModel(service: FakeLibraryService(refreshFailure: .offline))
                    await viewModel.start()
                    #expect(viewModel.state == .loaded(BookSummary.samples))
                    #expect(viewModel.banner == .offline)
                }

                @Test("Si guardar el favorito falla, se revierte")
                func revertsFavoriteOnFailure() async throws {
                    let viewModel = LibraryViewModel(service: FakeLibraryService(favoriteFailure: .offline))
                    await viewModel.start()
                    let book = try #require(BookSummary.samples.first)

                    await viewModel.toggleFavorite(book)

                    guard case .loaded(let books) = viewModel.state else {
                        Issue.record("Se esperaban libros cargados")
                        return
                    }
                    #expect(books.first?.isFavorite == book.isFavorite)
                    #expect(viewModel.banner == .offline)
                }
            }
          `, 'LibraryAppTests/LibraryViewModelTests.swift'),
          p('Los tests son deterministas porque el fake **termina** su stream: `await viewModel.start()` vuelve cuando la observación y el refresco han acabado. Nada de `sleep` ni esperas arbitrarias. Tienes más técnicas en [Testear ViewModels que dependen de KMP](#l-testear-viewmodels).'),
          h('Swift: la traducción, con tipos reales de Kotlin'),
          code('swift', S`
            import Testing
            import Shared
            @testable import LibraryApp

            @Suite("Traducción de errores de Kotlin")
            struct LibraryFailureMappingTests {

                @Test func translatesEveryDomainError() {
                    #expect(LibraryFailure(LibraryErrorOffline.shared) == .offline)
                    #expect(LibraryFailure(LibraryErrorNotFound.shared) == .notFound)
                    #expect(LibraryFailure(LibraryErrorServer(code: 503)) == .server(code: 503))
                    #expect(LibraryFailure(LibraryErrorUnknown(message: "boom")) == .unknown("boom"))
                }

                @Test func cancellationIsNotAFailure() {
                    #expect(LibraryFailure(CancellationError()) == .cancelled)
                }
            }
          `, 'LibraryAppTests/LibraryFailureMappingTests.swift'),
          note('kmp', 'Los argumentos de un test parametrizado deben ser Sendable', 'Los objetos de Kotlin no lo son. Parametriza con valores Swift (como `LibraryFailure`) y crea los objetos de Kotlin dentro del cuerpo del test, como arriba.'),
          h('Revisión final'),
          steps([
            'Ninguna vista ni ViewModel hace `import Shared`.',
            'Todas las llamadas a KMP pasan por `KMPLibraryService` y sus errores por `LibraryFailure`.',
            'Los Flows se recogen en `.task` y `onTermination` cancela la recolección.',
            'Hay una preview por estado: cargando, vacío, error, aviso con datos y contenido.',
            'Los textos están en el String Catalog y las filas se leen bien con VoiceOver.',
            'Pasan los tests de `commonTest` y los de la app.'
          ]),
          p('Para tus próximas PR tienes la lista completa en la [Checklist de PR](#checklist). Y si quieres seguir practicando: añade paginación a la lista, un indicador de «sin conexión» con datos en caché o prueba Swift export en una rama comparando cuánto código del adaptador desaparece.'),
          keys([
            'Reglas de negocio: tests en `commonTest`. Presentación y traducción: tests en Swift.',
            'Fakes que terminan su stream hacen deterministas los tests del ViewModel.',
            'Prueba la traducción de errores con tipos reales de Kotlin.',
            'Revisa la frontera antes de la PR: imports, errores, cancelación, previews y accesibilidad.'
          ])
        ],
        quiz: [
          q('¿Por qué `await viewModel.start()` no se queda esperando para siempre en los tests?', [
            'Porque Swift Testing cancela las tareas al momento',
            'Porque el fake termina su `AsyncStream` y el refresco acaba, así que el task group completa',
            'Porque `start()` tiene un timeout interno'
          ], 1, 'El servicio real nunca termina su stream (la caché sigue viva), pero el fake sí. Por eso la observación acaba y el test es determinista.'),
          q('¿Dónde pruebas que la búsqueda ignora textos de una letra?', [
            'En un test de UI de iOS',
            'En `commonTest`, contra `SearchBooksUseCase`',
            'En los tests del ViewModel de Swift'
          ], 1, 'La regla vive en Kotlin; se prueba una vez allí y protege a Android e iOS.'),
          q('Quieres un test parametrizado con varios `LibraryError` de Kotlin. ¿Cómo lo planteas?', [
            'Pasando los objetos de Kotlin directamente en `arguments:`',
            'Parametrizando con valores Swift y creando los objetos de Kotlin dentro del test',
            'No se puede testear código que usa Kotlin'
          ], 1, 'Swift Testing exige argumentos `Sendable` y los objetos de Kotlin no lo son. Los valores Swift sí.')
        ]
      }
    ]
  });
})();
