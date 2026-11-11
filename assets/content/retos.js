/* Retos de revisión de código: encuentra las líneas problemáticas */
(function () {
  'use strict';
  const { S } = Curso.dsl;

  // ───────────────────────────────────────────────────────────────────────
  Curso.challenge({
    id: 'reto-viewmodel-legacy',
    title: 'El ViewModel de la vieja escuela',
    level: 'Básico',
    topic: 'SwiftUI',
    intro: 'Este ViewModel “funciona” en la demo, pero en producción pierde estado y deja tareas vivas. Marca las líneas que cambiarías en un proyecto nuevo con iOS 17+.',
    lang: 'swift',
    code: S`
      import SwiftUI
      import Combine

      final class LibraryViewModel: ObservableObject {
          @Published var books: [BookSummary] = []
          @Published var errorMessage: String?
          private let service: any LibraryService

          init(service: any LibraryService) {
              self.service = service
              Task {
                  for await books in service.books() {
                      self.books = books
                  }
              }
          }
      }

      struct LibraryScreen: View {
          @ObservedObject var viewModel: LibraryViewModel

          init(service: any LibraryService) {
              viewModel = LibraryViewModel(service: service)
          }

          var body: some View {
              List(viewModel.books) { book in
                  Text(book.title)
              }
          }
      }
    `,
    issues: [
      {
        lines: [4],
        title: '`ObservableObject` sin `@MainActor`',
        why: 'En código nuevo (iOS 17+) usa `@Observable`: SwiftUI solo redibuja por lo que `body` lee y te ahorras Combine. Y márcalo `@MainActor`: es estado de UI y ahora nada garantiza que `books` se actualice en el hilo principal.',
      },
      {
        lines: [5, 6],
        title: 'Estado repartido en propiedades sueltas',
        why: '`books` + `errorMessage` permiten estados imposibles (¿datos y error a la vez?) y no expresan «cargando» ni «vacío». Modela la pantalla con un `enum State { loading, loaded, empty, failed }`.',
      },
      {
        lines: [11, 12, 13],
        title: 'Tarea sin dueño lanzada en el `init`',
        why: 'Nadie cancela esa tarea: la observación sigue viva al salir de la pantalla y se lanza otra cada vez que se crea un ViewModel (que, por la línea 23, es a menudo). Expón `func observeBooks() async` y llámalo desde `.task`.',
      },
      {
        lines: [20, 23],
        title: '`@ObservedObject` creado por la propia vista',
        why: '`@ObservedObject` no es dueño del objeto: como la vista lo crea en su `init`, cada vez que el padre se reevalúa nace un ViewModel nuevo y se pierde el estado. Para un objeto que la vista posee: `@State` con una clase `@Observable`.',
      },
    ],
    fixed: S`
      import SwiftUI

      @MainActor
      @Observable
      final class LibraryViewModel {
          enum State: Equatable {
              case loading, empty
              case loaded([BookSummary])
              case failed(LibraryFailure)
          }

          private(set) var state: State = .loading
          private let service: any LibraryService

          init(service: any LibraryService) {
              self.service = service          // init barato: solo dependencias
          }

          func observeBooks() async {
              for await books in service.books() {
                  state = books.isEmpty ? .empty : .loaded(books)
              }
          }
      }

      struct LibraryScreen: View {
          @State private var viewModel: LibraryViewModel

          init(service: any LibraryService) {
              _viewModel = State(initialValue: LibraryViewModel(service: service))
          }

          var body: some View {
              LibraryContent(state: viewModel.state)
                  .task { await viewModel.observeBooks() }   // se cancela sola
          }
      }
    `,
    fixedNote: 'El ViewModel es `@MainActor @Observable`, su `init` solo guarda dependencias y el trabajo empieza en `.task`, que se cancela al salir. La vista es dueña del ViewModel con `@State`. Repasa [Estado y flujo de datos](#/l/estado).',
  });

  // ───────────────────────────────────────────────────────────────────────
  Curso.challenge({
    id: 'reto-lista-parpadea',
    title: 'La lista que parpadea',
    level: 'Intermedio',
    topic: 'SwiftUI',
    intro: 'Cada vez que llega un dato nuevo, la lista parpadea, las animaciones saltan y se pierde el estado de las filas. Encuentra las causas.',
    lang: 'swift',
    code: S`
      struct BookListScreen: View {
          let books: [BookSummary]
          let showFavoritesOnly: Bool

          var body: some View {
              let visible = books
                  .filter { !showFavoritesOnly || $0.isFavorite }
                  .sorted { $0.title < $1.title }

              List {
                  ForEach(visible.indices, id: \.self) { index in
                      row(for: visible[index])
                  }
              }
          }

          func row(for book: BookSummary) -> AnyView {
              if book.isFavorite {
                  return AnyView(
                      Text(book.title)
                          .bold()
                          .id(UUID())
                  )
              }
              return AnyView(Text(book.title))
          }
      }
    `,
    issues: [
      {
        lines: [6, 7, 8],
        title: 'Filtrar y ordenar dentro de `body`',
        why: '`body` se evalúa muchas veces; filtrar y ordenar en cada evaluación es trabajo repetido. Que el ViewModel entregue la lista lista para pintar.',
      },
      {
        lines: [11, 12],
        title: 'Índices como identidad',
        why: 'Con `indices` la identidad es la posición: al filtrar u ordenar, cada fila hereda el estado y las animaciones de otra. Usa `ForEach(visible) { book in ... }` con el `id` estable del dominio.',
      },
      {
        lines: [17, 19, 25],
        title: '`AnyView` y función en lugar de subvista',
        why: '`AnyView` borra el tipo: SwiftUI no puede comparar ramas ni animar bien. Usa una subvista `struct BookRow` y deja que `body` (que ya es `@ViewBuilder`) componga las ramas.',
      },
      {
        lines: [22],
        title: '`.id(UUID())` en cada render',
        why: 'Genera una identidad nueva en cada evaluación: la fila se destruye y se recrea siempre, pierde su estado y reinicia sus tareas. Es la causa directa del parpadeo.',
      },
    ],
    fixed: S`
      struct BookListScreen: View {
          let books: [BookSummary]   // ya filtrados y ordenados por el ViewModel

          var body: some View {
              List(books) { book in
                  BookRow(book: book)
              }
          }
      }

      struct BookRow: View {
          let book: BookSummary

          var body: some View {
              Text(book.title)
                  .fontWeight(book.isFavorite ? .bold : .regular)
          }
      }
    `,
    fixedNote: 'Identidad estable (ids del dominio), una subvista con entradas mínimas y un modificador cuyo *valor* cambia en lugar de ramas distintas. Repasa [Composición e identidad](#/l/composicion).',
  });

  // ───────────────────────────────────────────────────────────────────────
  Curso.challenge({
    id: 'reto-flow-sin-fin',
    title: 'El Flow que nunca muere',
    level: 'Avanzado',
    topic: 'KMP',
    intro: 'Una pantalla de favoritos consume directamente los casos de uso de KMP. Tras navegar un rato, la app consume batería y a veces no refleja errores. ¿Qué cambiarías?',
    lang: 'swift',
    code: S`
      import SwiftUI
      import Shared

      struct FavoritesScreen: View {
          let observeBooks: ObserveBooksUseCase
          let setFavorite: SetFavoriteUseCase
          @State private var books: [Book] = []

          var body: some View {
              List(books, id: \.id) { book in
                  Button(book.title) {
                      Task {
                          try? await setFavorite.invoke(id: book.id, favorite: !book.isFavorite)
                      }
                  }
              }
              .onAppear {
                  Task {
                      for await books in observeBooks.invoke() {
                          self.books = books
                      }
                  }
              }
          }
      }
    `,
    issues: [
      {
        lines: [2, 5, 6],
        title: 'La vista depende de casos de uso de Kotlin',
        why: 'Una vista que importa `Shared` queda acoplada al puente (SKIE hoy, Swift export mañana), sus previews arrancan KMP y mete tipos no `Sendable` en la capa de UI. La vista habla con un ViewModel, que habla con un protocolo Swift (`LibraryService`).',
      },
      {
        lines: [7, 10],
        title: 'Objetos Kotlin como estado de la vista',
        why: '`[Book]` son objetos Kotlin: no son `Sendable`, su identidad no es estable entre emisiones del Flow y obligan a la vista a conocer el modelo de Kotlin. Mapea a `BookSummary` (struct Swift `Identifiable`) en la capa adaptadora.',
      },
      {
        lines: [13],
        title: '`try?` se traga el error',
        why: 'Si falla (sin conexión, `LibraryException`), el usuario no se entera y la UI no revierte nada. Captura el error, tradúcelo a `LibraryFailure` y muéstralo.',
      },
      {
        lines: [17, 18, 19],
        title: 'Recolectar el Flow en `onAppear` con `Task {}`',
        why: 'Nadie cancela esa tarea: al salir de la pantalla el Flow sigue recolectándose y cada `onAppear` lanza otro colector. Con `.task { await viewModel.observeBooks() }` la tarea se cancela al desaparecer y SKIE propaga la cancelación a la corrutina.',
      },
    ],
    fixed: S`
      import SwiftUI

      struct FavoritesScreen: View {
          @State private var viewModel: LibraryViewModel

          init(service: any LibraryService) {
              _viewModel = State(initialValue: LibraryViewModel(service: service))
          }

          var body: some View {
              LibraryContent(
                  state: viewModel.state,
                  onToggleFavorite: { book in
                      Task { await viewModel.toggleFavorite(book) }
                  }
              )
              .task { await viewModel.observeBooks() }   // se cancela al salir
          }
      }
    `,
    fixedNote: 'La vista ya no importa `Shared`. El ViewModel usa `LibraryService` (protocolo Swift) y el adaptador `KMPLibraryService` es el único que toca casos de uso Kotlin, mapea `Book` → `BookSummary` y traduce errores. Mira el [proyecto guiado](#/l/p3-viewmodel).',
  });

  // ───────────────────────────────────────────────────────────────────────
  Curso.challenge({
    id: 'reto-errores-silenciosos',
    title: 'Errores que desaparecen',
    level: 'Intermedio',
    topic: 'Swift',
    intro: 'El detalle de un libro a veces sale en blanco y, de vez en cuando, la app se cierra sola. Revisa el ViewModel.',
    lang: 'swift',
    code: S`
      @MainActor
      @Observable
      final class BookDetailViewModel {
          var book: BookSummary?
          var errorText = ""
          private let service: any LibraryService
          private let bookID: String

          init(bookID: String, service: any LibraryService) {
              self.bookID = bookID
              self.service = service
          }

          func load() async {
              book = try? await service.book(id: bookID)
          }

          func toggleFavorite() async {
              do {
                  try await service.setFavorite(!book!.isFavorite, for: bookID)
                  book!.isFavorite.toggle()
              } catch {
                  let failure = error as! LibraryFailure
                  errorText = "Error: \(failure)"
              }
          }

          var coverURL: URL {
              URL(string: book?.coverURL?.absoluteString ?? "")!
          }
      }
    `,
    issues: [
      {
        lines: [15],
        title: '`try?` convierte cualquier fallo en `nil`',
        why: 'Un error de red, un `notFound` o una cancelación acaban como `book == nil`: la vista no distingue «cargando» de «falló» y el usuario ve una pantalla en blanco. Modela el estado (`loading`, `loaded`, `failed`) y captura el error.',
      },
      {
        lines: [20, 21],
        title: 'Force unwrap de `book`',
        why: 'Si el usuario pulsa antes de que cargue, o tras un fallo, `book!` provoca un crash. Usa `guard let` (o `guard case .loaded`) y sal si no hay libro.',
      },
      {
        lines: [23],
        title: 'Force cast del error',
        why: '`as!` hace crash ante cualquier error que no sea `LibraryFailure`. Con *typed throws*, `do throws(LibraryFailure)` te da el tipo exacto sin casts; con `throws` normal, usa `catch let failure as LibraryFailure`.',
      },
      {
        lines: [24],
        title: 'Mensaje técnico para el usuario',
        why: 'Interpolar el error muestra su descripción interna (`server(code: 503)`). Traduce cada caso a un texto localizado en la capa de presentación.',
      },
      {
        lines: [29],
        title: '`URL` con force unwrap',
        why: '`URL(string: "")` devuelve `nil`: en cuanto un libro no tenga portada, crash. Expón el `URL?` que ya tienes y deja que la vista muestre un *placeholder*.',
      },
    ],
    fixed: S`
      @MainActor
      @Observable
      final class BookDetailViewModel {
          enum State: Equatable {
              case loading
              case loaded(BookSummary)
              case failed(LibraryFailure)
          }

          private(set) var state: State = .loading
          private(set) var actionError: LibraryFailure?   // la vista lo traduce a texto
          private let service: any LibraryService
          private let bookID: String

          init(bookID: String, service: any LibraryService) {
              self.bookID = bookID
              self.service = service
          }

          func load() async {
              do throws(LibraryFailure) {
                  state = .loaded(try await service.book(id: bookID))
              } catch {
                  if error != .cancelled { state = .failed(error) }
              }
          }

          func toggleFavorite() async {
              guard case .loaded(var book) = state else { return }
              do throws(LibraryFailure) {
                  try await service.setFavorite(!book.isFavorite, for: book.id)
                  book.isFavorite.toggle()
                  state = .loaded(book)
              } catch {
                  if error != .cancelled { actionError = error }
              }
          }
      }
    `,
    fixedNote: 'Estado explícito en un `enum`, sin `!` ni `as!`, *typed throws* para recibir `LibraryFailure` sin casts y la cancelación tratada como lo que es: no es un error para el usuario. La portada se usa directamente como `URL?` desde la vista. Repasa [Opcionales](#/l/opcionales) y [Enums y errores](#/l/errores-enums).',
  });

  // ───────────────────────────────────────────────────────────────────────
  Curso.challenge({
    id: 'reto-navegacion-banderas',
    title: 'Navegación con banderas',
    level: 'Intermedio',
    topic: 'SwiftUI',
    intro: 'La lista tarda en abrirse cuando hay muchos libros y la hoja de compartir a veces aparece vacía. Encuentra los problemas de navegación y de dependencias.',
    lang: 'swift',
    code: S`
      import SwiftUI
      import Shared

      struct LibraryScreen: View {
          let books: [BookSummary]
          let container: LibraryContainer
          @State private var showShare = false
          @State private var selectedBook: Book?

          var body: some View {
              NavigationView {
                  List(books) { book in
                      NavigationLink(destination: BookDetailScreen(
                          bookID: book.id,
                          service: KMPLibraryService(container: container)
                      )) {
                          BookRow(book: book)
                      }
                  }
                  .sheet(isPresented: $showShare) {
                      if let selectedBook {
                          ShareSheet(title: selectedBook.title)
                      }
                  }
              }
          }
      }
    `,
    issues: [
      {
        lines: [11],
        title: '`NavigationView` está obsoleto',
        why: 'Usa `NavigationStack(path:)`: navegación basada en datos, programable, testeable y compatible con deep links.',
      },
      {
        lines: [13, 14],
        title: 'Destino construido de forma ansiosa',
        why: '`NavigationLink(destination:)` crea `BookDetailScreen` (con su ViewModel) por cada fila que se pinta, aunque nunca navegues. Usa `NavigationLink(value: Route.book(id:))` + `navigationDestination(for:)`.',
      },
      {
        lines: [2, 6, 15],
        title: 'La pantalla construye dependencias de KMP',
        why: 'Crear `KMPLibraryService` dentro de la vista dispersa el composition root (un adaptador nuevo por fila) y obliga a importar `Shared`. Las dependencias se crean una vez en `AppDependencies` y se inyectan.',
      },
      {
        lines: [7, 8, 20],
        title: 'Bandera + opcional con un objeto Kotlin',
        why: '`showShare` y `selectedBook` pueden desincronizarse (hoja vacía) y `selectedBook` es un `Book` de Kotlin guardado en la vista. Usa `.sheet(item:)` con un `BookSummary?`.',
      },
    ],
    fixed: S`
      import SwiftUI

      struct RootView: View {
          @State private var router = Router()
          let dependencies: AppDependencies

          var body: some View {
              NavigationStack(path: $router.path) {
                  LibraryScreen(service: dependencies.library)   // pinta BookListRows
                      .navigationDestination(for: Route.self) { route in
                          switch route {
                          case .book(let id):
                              BookDetailScreen(bookID: id, service: dependencies.library)
                          }
                      }
              }
              .environment(router)
          }
      }

      struct BookListRows: View {
          let books: [BookSummary]
          @State private var sharing: BookSummary?

          var body: some View {
              List(books) { book in
                  NavigationLink(value: Route.book(id: book.id)) {
                      BookRow(book: book)
                  }
                  .swipeActions {
                      Button("Compartir") { sharing = book }
                  }
              }
              .sheet(item: $sharing) { book in
                  ShareSheet(title: book.title)
              }
          }
      }
    `,
    fixedNote: 'La pila es un array de rutas con ids, el destino se construye al navegar y las dependencias llegan ya creadas desde el composition root. La hoja depende de un único opcional `Identifiable` y ya no guarda objetos Kotlin. Repasa [Navegación tipada](#/l/navegacion).',
  });

  // ───────────────────────────────────────────────────────────────────────
  Curso.challenge({
    id: 'reto-hilos-antiguos',
    title: 'Hilos a la antigua',
    level: 'Avanzado',
    topic: 'Concurrencia',
    intro: 'Una caché de portadas escrita con hábitos de la era GCD. En Swift 6 ni siquiera compila, y en Swift 5 tiene un *data race*. Marca lo que cambiarías.',
    lang: 'swift',
    code: S`
      final class ImageCache {
          static let shared = ImageCache()
          var images: [URL: UIImage] = [:]

          func image(for url: URL) async throws -> UIImage {
              if let cached = images[url] { return cached }
              let (data, _) = try await URLSession.shared.data(from: url)
              let image = UIImage(data: data)!
              images[url] = image
              return image
          }
      }

      @MainActor
      @Observable
      final class CoverViewModel {
          var cover: UIImage?

          func load(_ url: URL) {
              Task.detached {
                  let image = try await ImageCache.shared.image(for: url)
                  DispatchQueue.main.async {
                      self.cover = image
                  }
              }
          }
      }
    `,
    issues: [
      {
        lines: [1, 2, 3],
        title: 'Estado mutable compartido sin protección',
        why: 'Un singleton con un diccionario `var` accesible desde varios hilos es un *data race*. En Swift 6 no compila (`shared` no es *concurrency-safe*). Conviértelo en `actor ImageCache` y el compilador serializará el acceso.',
      },
      {
        lines: [8],
        title: 'Force unwrap de datos externos',
        why: 'Una respuesta corrupta o un HTML de error = crash. Si `UIImage(data:)` devuelve `nil`, lanza un error.',
      },
      {
        lines: [20, 21],
        title: '`Task.detached` sin motivo y error perdido',
        why: '`Task.detached` pierde el aislamiento, la prioridad y los *task-locals*, nadie guarda la tarea para cancelarla y el error del `try` se pierde en silencio. Haz `load` `async` y llámalo desde `.task` en la vista.',
      },
      {
        lines: [22, 23],
        title: '`DispatchQueue.main` dentro de código async',
        why: 'Mezclar GCD con async/await es innecesario y confunde el modelo de aislamiento. En un ViewModel `@MainActor`, después del `await` ya estás en el actor principal: asigna directamente y deja que el compilador compruebe el aislamiento.',
      },
    ],
    fixed: S`
      actor ImageCache {
          private var images: [URL: UIImage] = [:]

          func image(for url: URL) async throws -> UIImage {
              if let cached = images[url] { return cached }
              let (data, _) = try await URLSession.shared.data(from: url)
              guard let image = UIImage(data: data) else {
                  throw URLError(.cannotDecodeContentData)
              }
              images[url] = image
              return image
          }
      }

      @MainActor
      @Observable
      final class CoverViewModel {
          private(set) var cover: UIImage?
          private let cache: ImageCache

          init(cache: ImageCache) {
              self.cache = cache   // inyectado: testeable y sin singleton
          }

          func load(_ url: URL) async {
              // Decisión consciente: si la portada falla, la vista muestra un placeholder
              cover = try? await cache.image(for: url)
          }
      }
    `,
    fixedNote: 'El actor protege el diccionario y el ViewModel se queda en el actor principal sin GCD. Ojo con la reentrada: dos peticiones simultáneas de la misma URL pueden descargarla dos veces; si importa, guarda en el actor las tareas en curso. Repasa [Aislamiento](#/l/aislamiento).',
  });

  // ───────────────────────────────────────────────────────────────────────
  Curso.challenge({
    id: 'reto-api-kotlin-hostil',
    title: 'Una API Kotlin hostil para Swift',
    level: 'Avanzado',
    topic: 'KMP',
    intro: 'El equipo KMP te pide revisión antes de publicar esta API en el módulo compartido. Compila y funciona en Android… pero piensa en cómo se verá y se comportará desde Swift.',
    lang: 'kotlin',
    code: S`
      package com.example.tasks

      import kotlinx.coroutines.flow.Flow

      class Task(val id: Long, val title: String, val done: Boolean)

      sealed class Result<out T> {
          data class Success<T>(val value: T) : Result<T>()
          data class Failure(val error: Throwable) : Result<Nothing>()
      }

      interface Repository<T> {
          suspend fun getAll(): List<T>
          fun observe(): Flow<List<T>>
      }

      class GetTasksUseCase(private val repository: Repository<Task>) {
          suspend operator fun invoke(
              includeDone: Boolean = false,
              limit: Int = 50,
          ): List<Task> =
              repository.getAll()          // puede lanzar IOException
                  .filter { includeDone || !it.done }
                  .take(limit)
      }
    `,
    issues: [
      {
        lines: [5],
        title: 'Una clase llamada `Task`',
        why: 'En Swift, `Task` es el tipo central de la concurrencia. En cada archivo que importe `Shared`, `Task { }` apuntaría a tu clase y habría que escribir `_Concurrency.Task`. Renómbrala (`TodoItem`) o usa `@ObjCName(swiftName = ...)`.',
      },
      {
        lines: [7, 8, 9],
        title: 'Un `Result` genérico propio',
        why: 'Choca con `Swift.Result` y, al ser genérico, se degrada en Swift: `T` tiene que ser un objeto, así que `List<Task>` llega como `NSArray` e `Int` como `KotlinInt`, con casts por todas partes. Para Swift: excepciones de dominio declaradas con `@Throws` o una `sealed` concreta por caso.',
      },
      {
        lines: [12, 13, 14],
        title: 'Interfaz genérica y Flow sin plan',
        why: 'Los protocolos de Objective-C no tienen genéricos: en Swift `Repository` pierde `T` y `getAll()` devuelve `[Any]`. Además `observe()` expone un `Flow` que Swift no puede consumir sin un puente (SKIE, KMP-NativeCoroutines o Swift export). Interfaces concretas (`TodoRepository`) y puente decidido antes de publicar Flows.',
      },
      {
        lines: [19, 20],
        title: 'Argumentos por defecto',
        why: 'El export a Objective-C no conserva los valores por defecto: desde Swift hay que pasar siempre `includeDone` y `limit` (SKIE puede generar sobrecargas si lo activas). No diseñes la API contando con ellos.',
      },
      {
        lines: [18, 22],
        title: 'Excepciones sin `@Throws`',
        why: 'Si `getAll()` lanza (red, base de datos) y la función no declara `@Throws`, cualquier excepción distinta de `CancellationException` que llegue a Swift **termina la app**. Declara `@Throws(TodoException::class, CancellationException::class)` y traduce los fallos técnicos a excepciones de dominio.',
      },
    ],
    fixed: S`
      package com.example.tasks

      import kotlin.coroutines.cancellation.CancellationException
      import kotlinx.coroutines.flow.Flow

      data class TodoItem(val id: String, val title: String, val isDone: Boolean)

      sealed interface TodoError {
          data object Offline : TodoError
          data class Server(val code: Int) : TodoError
      }

      class TodoException(val error: TodoError) : Exception()

      interface TodoRepository {
          suspend fun all(): List<TodoItem>      // traduce IOException → TodoException
          fun observeAll(): Flow<List<TodoItem>> // consumido vía SKIE como AsyncSequence
      }

      class GetTodosUseCase(private val repository: TodoRepository) {
          @Throws(TodoException::class, CancellationException::class)
          suspend operator fun invoke(includeDone: Boolean, limit: Int): List<TodoItem> =
              repository.all()
                  .filter { includeDone || !it.isDone }
                  .take(limit)
      }
    `,
    fixedNote: 'Desde Swift se usa como `try await getTodos.invoke(includeDone: false, limit: 50)` y los fallos llegan como `NSError` cuyo `kotlinException` es un `TodoException`; con SKIE, `onEnum(of: exception.error)` da un `switch` exhaustivo. Si queréis llamarlo como `getTodos(...)`, añadid en Swift una extensión con `callAsFunction`. Repasa [Cómo ve Swift tu código Kotlin](#/l/kotlin-desde-swift).',
  });
})();
