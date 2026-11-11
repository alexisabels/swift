(function () {
  'use strict';
  const { S } = Curso.dsl;

  // Cada entrada: Kotlin → Swift con el export Obj-C por defecto → Swift con SKIE,
  // más el estado en Swift export (Alpha en Kotlin 2.4.x) y una recomendación.
  Curso.interop([
    {
      id: 'numeros',
      title: 'Números: `Int`, `Long`, `Double`',
      summary: 'Los enteros de Kotlin tienen tamaño fijo; el `Int` de Swift es de 64 bits en iOS.',
      lesson: 'kotlin-desde-swift',
      kotlin: S`
        data class Book(
            val pages: Int,
            val downloads: Long,
            val rating: Double,
        )
      `,
      objc: S`
        let pages: Int32 = book.pages
        let downloads: Int64 = book.downloads
        let rating: Double = book.rating

        let total = Int(book.pages) * 2   // conversión explícita
      `,
      objcNote: '`Int` → `Int32`, `Long` → `Int64`, `Double` → `Double`, `Boolean` → `Bool`.',
      skie: S`
        // Igual que sin SKIE: los tamaños no cambian
        let pages: Int32 = book.pages
      `,
      skieNote: 'SKIE no toca los tipos numéricos.',
      swiftExport: 'También conserva los tamaños (`Int32`, `Int64`), sin pasar por Objective-C.',
      advice: 'Convierte a `Int` en el mapeo del adaptador. Tus modelos Swift usan `Int`, como el resto de APIs de Apple.'
    },
    {
      id: 'nulos',
      title: 'Primitivos opcionales: `Int?`',
      summary: 'Un primitivo que admite nulo no cabe en un tipo primitivo de Objective-C: viaja en una caja.',
      lesson: 'kotlin-desde-swift',
      kotlin: S`
        data class Book(
            val pages: Int?,
            val isSigned: Boolean?,
            val subtitle: String?,
        )
      `,
      objc: S`
        let pages: KotlinInt? = book.pages          // subclase de NSNumber
        let signed: KotlinBoolean? = book.isSigned
        let subtitle: String? = book.subtitle      // String? sí llega tal cual

        let pageCount: Int? = book.pages?.intValue
      `,
      objcNote: 'Los primitivos opcionales llegan como `KotlinInt?`, `KotlinBoolean?`… Los tipos de referencia (`String?`) llegan como opcionales normales.',
      skie: S`
        let pages: KotlinInt? = book.pages
        let pageCount = book.pages?.intValue
      `,
      skieNote: 'Las cajas se mantienen.',
      swiftExport: 'Sin Objective-C de por medio no hacen falta cajas para la mayoría de primitivos opcionales; compruébalo en tu versión.',
      advice: 'Desempaqueta en el adaptador (`?.intValue`, `?.boolValue`) y no dejes que `KotlinInt` llegue al ViewModel.'
    },
    {
      id: 'colecciones',
      title: 'Colecciones: `List`, `Map`, `Set`',
      summary: 'Las colecciones de solo lectura se traducen bien; las mutables y las de primitivos tienen matices.',
      lesson: 'kotlin-desde-swift',
      kotlin: S`
        class Shelf(
            val books: List<Book>,
            val byAuthor: Map<String, List<Book>>,
            val ratings: List<Int>,
        )
      `,
      objc: S`
        let books: [Book] = shelf.books
        let byAuthor: [String: [Book]] = shelf.byAuthor
        let ratings: [KotlinInt] = shelf.ratings    // primitivos en caja

        let values = shelf.ratings.map(\.intValue)
      `,
      objcNote: '`List<T>` → `[T]`, `Map<K, V>` → `[K: V]`, `Set<T>` → `Set<T>`. Dentro de una colección, los primitivos van en caja (`[KotlinInt]`). `MutableList` llega como `NSMutableArray`.',
      skie: S`
        let books: [Book] = shelf.books
        let ratings: [KotlinInt] = shelf.ratings
      `,
      skieNote: 'Mismo resultado: las colecciones ya se traducían bien.',
      swiftExport: 'Las colecciones se exportan como colecciones Swift con el tipo de elemento real.',
      advice: 'Expón colecciones de solo lectura en la API pública y mapea los elementos a structs Swift en el adaptador.'
    },
    {
      id: 'data-class',
      title: '`data class`',
      summary: 'Llega como clase (tipo referencia), no como struct: no esperes semántica de valor.',
      lesson: 'capa-adaptadora',
      kotlin: S`
        data class Book(
            val id: String,
            val title: String,
            val isFavorite: Boolean,
        )
      `,
      objc: S`
        let book = Book(id: "1", title: "Nada", isFavorite: false)
        let favorite = book.doCopy(id: book.id, title: book.title, isFavorite: true)

        book == favorite        // usa isEqual (equals de Kotlin)
        book.description        // toString() de Kotlin
      `,
      objcNote: 'Es una clase con `isEqual`, `hash` y `description`. `copy` se llama `doCopy` y exige todos los parámetros.',
      skie: S`
        let favorite = book.doCopy(id: book.id, title: book.title, isFavorite: true)
      `,
      skieNote: 'Igual. Con la opción de parámetros por defecto de SKIE, `doCopy` admite omitir argumentos.',
      swiftExport: 'Se exporta como clase Swift. Sigue siendo un tipo referencia.',
      advice: 'Mapea a un `struct` Swift `Hashable` y `Sendable` en el adaptador. Así tienes semántica de valor y encaja con `ForEach`, `Equatable` y Swift 6.'
    },
    {
      id: 'object',
      title: '`object` y `companion object`',
      summary: 'Los singletons de Kotlin se exponen a través de una propiedad.',
      lesson: 'kotlin-desde-swift',
      kotlin: S`
        object LibraryConfig {
            const val PAGE_SIZE = 20
        }

        class Book(val id: String) {
            companion object {
                fun placeholder() = Book("placeholder")
            }
        }
      `,
      objc: S`
        let size = LibraryConfig.shared.PAGE_SIZE
        let book = Book.companion.placeholder()
      `,
      objcNote: '`object` → `Tipo.shared`. `companion object` → `Tipo.companion`.',
      skie: S`
        let size = LibraryConfig.shared.PAGE_SIZE
        let book = Book.companion.placeholder()
      `,
      skieNote: 'Sin cambios.',
      swiftExport: 'Los `object` se exponen también con una instancia compartida.',
      advice: 'No dependas de singletons de Kotlin desde vistas o ViewModels. Si necesitas un valor de configuración, pásalo desde el composition root.'
    },
    {
      id: 'enum',
      title: '`enum class`',
      summary: 'Sin puente, un enum de Kotlin no es un enum de Swift.',
      lesson: 'sealed-errores',
      kotlin: S`
        enum class Genre { FICTION, HISTORY, SCIENCE }
      `,
      objc: S`
        switch book.genre {
        case .fiction: print("Ficción")
        case .history: print("Historia")
        default: print("Otro")   // obligatorio: es una clase
        }
      `,
      objcNote: 'Llega como una clase con propiedades estáticas. El `switch` necesita `default` y no detecta casos nuevos.',
      skie: S`
        switch book.genre {
        case .fiction: print("Ficción")
        case .history: print("Historia")
        case .science: print("Ciencia")
        }   // exhaustivo: un caso nuevo rompe la compilación
      `,
      skieNote: 'SKIE lo convierte en un `enum` de Swift: `switch` exhaustivo sin `default`.',
      swiftExport: 'Las versiones recientes exportan los `enum class` como enums de Swift.',
      advice: 'Sin SKIE, mapéalo a un enum Swift propio en el adaptador. Con SKIE, evita `default` en los `switch` para que el compilador te avise.'
    },
    {
      id: 'sealed',
      title: '`sealed class` / `sealed interface`',
      summary: 'La herramienta favorita de Kotlin para modelar estados y errores.',
      lesson: 'sealed-errores',
      kotlin: S`
        sealed interface LibraryError {
            data object Offline : LibraryError
            data class Server(val code: Int) : LibraryError
        }
      `,
      objc: S`
        if error is LibraryErrorOffline {
            showOffline()
        } else if let server = error as? LibraryErrorServer {
            showServer(Int(server.code))
        } else {
            showUnknown()   // el compilador no avisa de casos nuevos
        }
      `,
      objcNote: 'Una jerarquía de clases (`LibraryErrorOffline`, `LibraryErrorServer`). Solo puedes comprobar tipos con `is` y `as?`.',
      skie: S`
        switch onEnum(of: error) {
        case .offline:
            showOffline()
        case .server(let server):
            showServer(Int(server.code))
        }
      `,
      skieNote: '`onEnum(of:)` devuelve un enum de Swift con un caso por subtipo: `switch` exhaustivo.',
      swiftExport: 'Desde Kotlin 2.4.20, las sealed classes e interfaces se exportan con `switch` exhaustivo.',
      advice: 'Traduce los sealed a enums Swift propios en el adaptador. Tus ViewModels no deberían ver `onEnum(of:)`.'
    },
    {
      id: 'suspend',
      title: 'Funciones `suspend`',
      summary: 'Se pueden llamar con `await`, pero la cancelación solo cruza con un puente.',
      lesson: 'suspend-flow',
      kotlin: S`
        class RefreshBooksUseCase(private val repository: BookRepository) {
            @Throws(LibraryException::class, CancellationException::class)
            suspend operator fun invoke() = repository.refresh()
        }
      `,
      objc: S`
        // Importado desde un completion handler
        try await refreshBooks.invoke()

        // Si cancelas la Task de Swift, Kotlin sigue trabajando
      `,
      objcNote: 'Se exporta con un completion handler que Swift importa también como `async`. La cancelación no viaja a Kotlin.',
      skie: S`
        let task = Task {
            try await refreshBooks.invoke()
        }
        task.cancel()   // también cancela la corrutina de Kotlin
      `,
      skieNote: '`async` de verdad, con cancelación en los dos sentidos.',
      swiftExport: 'Desde Kotlin 2.4.0 (Alpha) las funciones `suspend` se exportan como `async`.',
      advice: 'Llámalas desde métodos `async` de un ViewModel `@MainActor`, dentro de `.task` o de una `Task` que guardes y canceles.'
    },
    {
      id: 'flow',
      title: '`Flow` y `StateFlow`',
      summary: 'El caso más importante: sin puente, un Flow es casi inutilizable desde Swift.',
      lesson: 'suspend-flow',
      kotlin: S`
        class ObserveBooksUseCase(private val repository: BookRepository) {
            operator fun invoke(): Flow<List<Book>> = repository.observeBooks()
        }

        class SessionStore {
            val isLoggedIn: StateFlow<Boolean> = MutableStateFlow(false)
        }
      `,
      objc: S`
        // Un protocolo de kotlinx.coroutines: no es una AsyncSequence
        let flow: Kotlinx_coroutines_coreFlow = observeBooks.invoke()

        // Habría que escribir en Kotlin un collector con callbacks
        // y gestionar a mano su cancelación.
      `,
      objcNote: 'Llega como `Kotlinx_coroutines_coreFlow`, sin tipo de elemento ni `for await`.',
      skie: S`
        for await books in observeBooks.invoke() {   // SkieSwiftFlow<[Book]>
            print(books.count)
        }

        let loggedIn = session.isLoggedIn.value      // SkieSwiftStateFlow: valor actual
        for await value in session.isLoggedIn { print(value) }
      `,
      skieNote: '`Flow<T>` → `SkieSwiftFlow<T>` y `StateFlow<T>` → `SkieSwiftStateFlow<T>`, ambos `AsyncSequence`. El `StateFlow` expone además `.value`.',
      swiftExport: 'Desde Kotlin 2.4.0 los Flows se exportan como `AsyncSequence` tipadas.',
      advice: 'Conviértelos en `AsyncStream` de tipos Swift en el adaptador y recórrelos dentro de `.task`. Pide que los errores del Flow lleguen como datos.'
    },
    {
      id: 'excepciones',
      title: 'Excepciones y `@Throws`',
      summary: 'La diferencia entre un error controlado y un crash está en una anotación.',
      lesson: 'sealed-errores',
      kotlin: S`
        class GetBookUseCase(private val repository: BookRepository) {
            @Throws(LibraryException::class, CancellationException::class)
            suspend operator fun invoke(id: String): Book = repository.book(id)
        }
      `,
      objc: S`
        do {
            let book = try await getBook.invoke(id: id)
        } catch {
            let kotlin = (error as NSError).kotlinException
            if let exception = kotlin as? LibraryException {
                handle(exception.error)
            }
        }
      `,
      objcNote: 'Las excepciones declaradas llegan como `NSError` con la original en `kotlinException`. Las no declaradas cierran la app. En `suspend`, sin `@Throws` solo se propaga `CancellationException`.',
      skie: S`
        do {
            let book = try await getBook.invoke(id: id)
        } catch {
            // Mismas reglas: @Throws sigue siendo necesario
        }
      `,
      skieNote: 'SKIE no cambia las reglas: necesitas `@Throws` igualmente.',
      swiftExport: 'El soporte de errores sigue evolucionando en Alpha: modela los errores esperados como datos o con excepciones de dominio declaradas.',
      advice: 'Exige `@Throws` en toda función pública que pueda fallar y traduce `kotlinException` a un enum Swift en un solo sitio.'
    },
    {
      id: 'default-args',
      title: 'Parámetros por defecto',
      summary: 'Objective-C no tiene valores por defecto.',
      lesson: 'kotlin-desde-swift',
      kotlin: S`
        class SearchBooksUseCase(private val repository: BookRepository) {
            suspend operator fun invoke(query: String, limit: Int = 20): List<Book> =
                repository.search(query, limit)
        }
      `,
      objc: S`
        // Todos los argumentos son obligatorios
        let books = try await searchBooks.invoke(query: "dune", limit: 20)
      `,
      objcNote: 'El valor por defecto desaparece: Swift tiene que pasar todos los argumentos.',
      skie: S`
        // Con DefaultArgumentInterop activado para esta función
        let books = try await searchBooks.invoke(query: "dune")
      `,
      skieNote: 'SKIE puede generar sobrecargas. Está desactivado por defecto porque aumenta el tamaño del binario: actívalo solo donde compense.',
      swiftExport: 'Revisa las notas de tu versión: el soporte va llegando por fases.',
      advice: 'En la API pública, prefiere funciones explícitas o un objeto de parámetros. Si no, fija el valor por defecto en tu adaptador.'
    },
    {
      id: 'genericos',
      title: 'Genéricos',
      summary: 'Solo sobreviven los genéricos de clases, y con argumentos de tipo objeto.',
      lesson: 'sealed-errores',
      kotlin: S`
        interface Repository<T> {
            suspend fun all(): List<T>
        }

        class Page<T>(val items: List<T>, val next: String?)
      `,
      objc: S`
        // Interfaz: el genérico se pierde
        let items = try await repository.all()   // [Any]

        // Clase: se conserva, pero solo con tipos objeto
        let page: Page<Book> = result
        let numbers: Page<KotlinInt> = counts
      `,
      objcNote: 'Las interfaces y funciones genéricas pierden el tipo (`Any`). Las clases genéricas lo conservan como genérico ligero de Objective-C, con primitivos en caja y colecciones como `NSArray`.',
      skie: S`
        let page: Page<Book> = result   // igual que sin SKIE
      `,
      skieNote: 'SKIE no recupera los genéricos que el export Obj-C pierde.',
      swiftExport: 'Soporte parcial y en evolución. Evita igualmente genéricos en la frontera.',
      advice: 'Pide tipos concretos en la API pública (`BookPage` en lugar de `Page<Book>`) y no uses interfaces genéricas como contrato con Swift.'
    },
    {
      id: 'lambdas',
      title: 'Lambdas y `Unit`',
      summary: 'Las funciones como parámetro funcionan, pero con cajas y `KotlinUnit`.',
      lesson: 'dependencias',
      kotlin: S`
        class SessionManager {
            fun addListener(onChange: (Int) -> Unit): Subscription = TODO()
        }
      `,
      objc: S`
        let subscription = session.addListener { [weak self] count in
            self?.update(Int(count.int32Value))   // count es KotlinInt
            return KotlinUnit()
        }
      `,
      objcNote: 'En los tipos función, los primitivos van en caja (`KotlinInt`) y `Unit` se devuelve como `KotlinUnit()`.',
      skie: S`
        let subscription = session.addListener { [weak self] count in
            self?.update(Int(count.int32Value))
            return KotlinUnit()
        }
      `,
      skieNote: 'Sin cambios relevantes para lambdas.',
      swiftExport: 'Sin Objective-C, las lambdas se exportan como closures de Swift; comprueba los casos con primitivos y `Unit` en tu versión.',
      advice: 'Para eventos, prefiere un `Flow` en la API pública. Si hay callbacks, captura `[weak self]` y exige una forma de darse de baja.'
    },
    {
      id: 'interfaces',
      title: 'Interfaces implementadas en Swift',
      summary: 'La forma de que el código compartido use APIs de la plataforma.',
      lesson: 'dependencias',
      kotlin: S`
        interface TokenStorage {
            fun read(): String?
            fun write(token: String?)
        }

        class LibraryContainer(tokenStorage: TokenStorage, baseUrl: String)
      `,
      objc: S`
        final class KeychainTokenStorage: TokenStorage {
            func read() -> String? { /* SecItemCopyMatching */ nil }
            func write(token: String?) { /* SecItemAdd */ }
        }

        let container = LibraryContainer(tokenStorage: KeychainTokenStorage(),
                                         baseUrl: "https://api.example.com")
      `,
      objcNote: 'Una interfaz de Kotlin llega como protocolo Objective-C y una clase Swift puede implementarla y pasársela a Kotlin.',
      skie: S`
        final class KeychainTokenStorage: TokenStorage {
            func read() -> String? { nil }
            func write(token: String?) {}
        }
      `,
      skieNote: 'Igual. Si la interfaz tiene funciones `suspend`, en Swift se implementan como métodos `async`.',
      swiftExport: 'Kotlin 2.4.20 añadió herencia entre lenguajes; confirma que tu caso concreto está soportado antes de migrar.',
      advice: 'Interfaces pequeñas y sin genéricos. Implementa en Swift, inyecta desde el composition root y evita guardar referencias fuertes a objetos de Kotlin dentro de la implementación.'
    },
    {
      id: 'nombres',
      title: 'Nombres que chocan con Swift',
      summary: 'Un `Task` o un `Result` en Kotlin tapa al de Swift en todo fichero que importe `Shared`.',
      lesson: 'kotlin-desde-swift',
      kotlin: S`
        data class Task(val id: String, val title: String)
        sealed interface Result
      `,
      objc: S`
        import Shared

        Task {                    // ahora es la clase de Kotlin, no la de Swift
            await load()
        }

        _Concurrency.Task {       // el parche de siempre
            await load()
        }
      `,
      objcNote: 'Las clases llegan sin prefijo a Swift y tapan los tipos del sistema con el mismo nombre.',
      skie: S`
        // Mismo problema: renombra en Kotlin
        @ObjCName(swiftName = "TodoTask")   // (anotación en el lado Kotlin)
      `,
      skieNote: 'SKIE no renombra tipos por ti.',
      swiftExport: 'Los paquetes de Kotlin pueden exportarse como espacios de nombres, lo que reduce los choques.',
      advice: 'Evita `Task`, `Result`, `Error`, `Data` o `Date` en la API pública. Si ya existen, usa `@ObjCName(swiftName:)`. Con Xcode 27 tienes `Shared::Task` como último recurso.'
    },
    {
      id: 'top-level',
      title: 'Funciones top-level y de extensión',
      summary: 'Kotlin permite funciones sueltas; Objective-C necesita una clase que las contenga.',
      lesson: 'kotlin-desde-swift',
      kotlin: S`
        // Fichero Formatting.kt
        fun formatIsbn(raw: String): String = raw.chunked(3).joinToString("-")

        fun Book.displayTitle(): String = title.uppercase()
      `,
      objc: S`
        let isbn = FormattingKt.formatIsbn(raw: "9788408")

        // Extensión sobre una clase de Kotlin: método normal en Swift
        let title = book.displayTitle()
      `,
      objcNote: 'Las funciones top-level van a una clase con el nombre del fichero (`FormattingKt`). Las extensiones sobre clases de Kotlin aparecen como métodos; las extensiones sobre `String` u otros tipos ajenos, como funciones estáticas de esa clase.',
      skie: S`
        let isbn = FormattingKt.formatIsbn(raw: "9788408")
      `,
      skieNote: 'Sin cambios.',
      swiftExport: 'Las funciones top-level se exportan como funciones de Swift agrupadas por paquete.',
      advice: 'Para la frontera, prefiere métodos en clases con nombre claro. Y lo que es puro formato de presentación, hazlo en Swift.'
    }
  ]);
})();
