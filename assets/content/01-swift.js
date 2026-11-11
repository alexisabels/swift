(function () {
  'use strict';
  const { p, h, code, compare, tabs, note, list, table, keys, q, S } = Curso.dsl;

  Curso.module({
    id: 'swift',
    order: 1,
    title: 'Swift moderno',
    short: 'Swift',
    icon: 'swift',
    description: 'Las bases del Swift actual con criterio: semántica de valor, opcionales, protocolos y errores. Pensado para quien viene de Kotlin y va a consumir un módulo KMP.',
    lessons: [
      // ---------------------------------------------------------------------
      {
        id: 'kotlin-a-swift',
        title: 'De Kotlin a Swift: el mapa mental',
        level: 'Básico',
        minutes: 12,
        tags: ['Kotlin', 'equivalencias', 'naming', 'API Design Guidelines'],
        summary: 'Qué equivale a qué entre Kotlin/Android y Swift/iOS, y dónde la equivalencia engaña.',
        blocks: [
          p('Si vienes de Kotlin, Swift te va a resultar familiar: tipos nullable, lambdas, extensiones, corrutinas… Pero hay tres diferencias de fondo que cambian cómo diseñas: la **semántica de valor**, los **errores declarados** y los **protocolos** como herramienta principal de abstracción. Esta lección es el mapa: qué equivale a qué y dónde la equivalencia engaña.'),
          h('Tabla de equivalencias'),
          table(['Kotlin / Android', 'Swift / iOS', 'El matiz'], [
            ['`val` / `var`', '`let` / `var`', 'En un struct, `let` congela el valor **entero**, no solo la referencia.'],
            ['`data class`', '`struct` + `Equatable` / `Hashable`', 'Se copia al asignar. No hay `copy()`: modificas una copia declarada con `var`.'],
            ['`sealed class` / `sealed interface`', '`enum` con valores asociados', 'El `switch` es exhaustivo sin `default`, igual que un `when` sin `else`.'],
            ['`enum class`', '`enum`', 'Los enums de Swift tienen métodos, propiedades calculadas y valores asociados.'],
            ['`interface`', '`protocol`', 'Admite tipos asociados y extensiones con implementación por defecto.'],
            ['Funciones de extensión', '`extension`', 'Extiendes el tipo real, incluso para añadirle conformancias a protocolos.'],
            ['`object` / `companion object`', '`static` / `static let shared`', 'No hay singletons implícitos; un `enum` sin casos sirve de *namespace*.'],
            ['`String?`', '`String?` (`Optional<String>`)', 'Es un enum de verdad: `.none` o `.some(valor)`.'],
            ['`suspend fun`', '`func … async`', 'La cancelación es cooperativa en ambos lenguajes.'],
            ['`scope.launch { }`', '`Task { }`', 'Una `Task` no estructurada no se cancela sola: guárdala o usa `.task`.'],
            ['`Flow<T>`', '`AsyncSequence` (`AsyncStream<T>`)', 'Se consume con `for await`.'],
            ['`StateFlow<T>` en un ViewModel', 'Propiedad de una clase `@Observable`', 'SwiftUI observa la propiedad: no hay `collectAsState()`.'],
            ['Jetpack Compose', 'SwiftUI', 'Ambos declarativos; las vistas de SwiftUI son structs baratos de recrear.'],
            ['`remember { mutableStateOf(…) }`', '`@State`', 'Vive mientras la vista conserve su identidad.'],
            ['`LaunchedEffect(key)`', '`.task(id:)`', 'Se cancela al desaparecer la vista o al cambiar el `id`.'],
            ['Hilt / Koin', 'Inyección por `init` + *composition root*', 'Para empezar no necesitas un framework de inyección.'],
            ['`Dispatchers.Main`', '`@MainActor`', 'El compilador comprueba el aislamiento: no es una convención.'],
            ['`viewModelScope`', '`.task` en la vista o una `Task` guardada', 'No hay un scope implícito ligado al ViewModel.'],
            ['Excepciones no comprobadas', '`throws` + `try` + `do/catch`', 'Cada llamada que puede fallar se marca con `try`.'],
          ]),
          h('Diferencia 1: los structs se copian'),
          tabs([
            ['Kotlin', 'kotlin', S`
              data class Book(val title: String, val isFavorite: Boolean)

              val original = Book("Dune", isFavorite = false)
              val updated = original.copy(isFavorite = true)
              // original sigue con isFavorite = false
            `],
            ['Swift', 'swift', S`
              struct Book {
                  let title: String
                  var isFavorite: Bool
              }

              let original = Book(title: "Dune", isFavorite: false)
              var updated = original        // copia independiente
              updated.isFavorite = true     // original no cambia
            `],
          ], 'Modificar un modelo inmutable'),
          p('En Swift no existe `copy()` porque no hace falta: asignar un struct ya crea una copia independiente. Declara con `let` lo que no cambia, con `var` lo que sí, y modifica la copia. Lo ves a fondo en [Structs, clases y semántica de valor](#/l/tipos-valor).'),
          h('Diferencia 2: los errores se declaran'),
          p('En Kotlin todas las excepciones son no comprobadas. En Swift, una función que puede fallar se marca con `throws` y cada llamada lleva `try`: el compilador no te deja ignorar un fallo sin decidirlo de forma explícita. Lo ves en [Enums y errores tipados](#/l/errores-enums).'),
          note('kmp', 'Las excepciones de Kotlin no cruzan la frontera solas', 'Si una función del módulo compartido lanza una excepción que no está declarada con `@Throws`, la app **se cierra** al llamarla desde Swift. Revisa [Sealed classes, enums y errores](#/l/sealed-errores) antes de consumir tu primer caso de uso.'),
          h('Diferencia 3: nombres al estilo Swift'),
          p('Las *Swift API Design Guidelines* buscan claridad **en el punto de uso**: las llamadas se leen como frases. Etiquetas de argumento con significado, sin prefijo `get`, booleanos que se leen como afirmaciones (`isEmpty`, `hasAccess`) y métodos con efectos nombrados como verbos (`sort()`) frente a su versión sin efectos (`sorted()`).'),
          compare('swift', S`
            protocol BookRepository {
                func getBook(bookId: String) async throws -> Book
                func getBooksByAuthor(author: String) -> [Book]
                func setFavorite(book: Book, value: Bool)
            }

            struct Book {
                var favorite: Bool
            }
          `, S`
            protocol BookRepository {
                func book(id: String) async throws -> Book
                func books(by author: String) -> [Book]
                func setFavorite(_ isFavorite: Bool, for book: Book)
            }

            struct Book {
                var isFavorite: Bool
            }

            // En el punto de uso se lee como una frase:
            // try await repository.book(id: "42")
            // repository.books(by: "Le Guin")
            // repository.setFavorite(true, for: book)
          `, {
            bad: 'Traducción literal de Java/Kotlin: prefijo `get`, etiquetas que repiten lo obvio y un booleano que no se lee como afirmación.',
            good: 'Las llamadas se leen como frases y el booleano responde a una pregunta: `book.isFavorite`.'
          }),
          note('tip', 'Lo que viene de Kotlin no sigue estas reglas', 'Los nombres del módulo compartido llegan a Swift casi tal cual (`getBook(bookId:)`, `Int32`, `KotlinInt`). No contagies tu código: la [capa adaptadora](#/l/capa-adaptadora) es el sitio para traducirlos a Swift idiomático.'),
          keys([
            'Piensa en `struct` + `let` como tu `data class` + `val` por defecto, pero con copia real.',
            'Las `sealed class` se modelan con `enum` y valores asociados; el `switch` exhaustivo es tu red de seguridad.',
            'Corrutinas → `async/await` y `Flow` → `AsyncSequence`; en SwiftUI el ciclo de vida lo marca `.task`, no un `viewModelScope`.',
            'En Swift los errores se declaran (`throws`); una excepción Kotlin sin `@Throws` cierra la app.',
            'Nombra al estilo Swift: etiquetas de argumento, sin `get`, booleanos como afirmaciones.'
          ]),
        ],
        quiz: [
          q('¿Cuál es el equivalente más fiel de una `sealed class` de Kotlin en Swift?',
            ['Una jerarquía de clases con `open class`', 'Un `protocol` con tipos asociados', 'Un `enum` con valores asociados', 'Un `struct` con un campo `type: String`'],
            2, 'Un `enum` con valores asociados representa un conjunto cerrado de casos, cada uno con sus datos, y el compilador exige que el `switch` los cubra todos, igual que un `when` sobre una sealed class.'),
          q('En SwiftUI, ¿qué sustituye a `LaunchedEffect(key)` de Compose?',
            ['`.task(id: key) { … }`', '`.onAppear { Task { … } }`', 'El `init()` de la vista', '`DispatchQueue.main.async { … }`'],
            0, '`.task(id:)` arranca trabajo asíncrono ligado a la vida de la vista, lo cancela al desaparecer y lo reinicia cuando cambia el `id`. `onAppear` + `Task` no cancela nada.'),
          q('¿Qué firma sigue las Swift API Design Guidelines?',
            ['`func getUser(userId: String) -> User`', '`func fetchUserById(id: String) -> User`', '`func GetUser(_ userId: String) -> User`', '`func user(id: String) -> User`'],
            3, 'Sin prefijo `get`, sin palabras redundantes y con una etiqueta que se lee bien en el punto de uso: `user(id: "42")`.'),
          q('`original` es un struct. Haces `var copy = original` y luego `copy.isFavorite = true`. ¿Qué le pasa a `original`?',
            ['Cambia también: comparten referencia', 'Nada: asignar un struct crea una copia independiente', 'No compila: los structs no se pueden copiar', 'Cambia solo si el struct es `Equatable`'],
            1, 'Los structs tienen semántica de valor: cada asignación produce una copia independiente.'),
        ],
      },

      // ---------------------------------------------------------------------
      {
        id: 'tipos-valor',
        title: 'Structs, clases y semántica de valor',
        level: 'Básico',
        minutes: 10,
        tags: ['struct', 'class', 'let', 'mutating', 'copy-on-write', 'Sendable'],
        summary: 'Por qué el struct es la opción por defecto y cuándo merece la pena una clase.',
        blocks: [
          p('En Swift, elegir entre `struct` y `class` no es cuestión de estilo: cambia cómo se comparte el estado. La regla práctica: **empieza por `struct`** y pasa a `class` solo cuando necesites identidad o estado compartido y mutable.'),
          h('Valor frente a referencia'),
          code('swift', S`
            struct Point { var x: Int }
            final class Counter { var value = 0 }

            var a = Point(x: 1)
            var b = a          // copia
            b.x = 99           // a.x sigue siendo 1

            let c1 = Counter()
            let c2 = c1        // la misma instancia
            c2.value = 99      // c1.value también es 99
          `, 'Diez líneas que lo explican todo'),
          p('Con structs, nadie puede cambiarte un valor «por detrás». Eso elimina una familia entera de bugs (estado compartido modificado desde otro sitio) y hace que los tipos sean fáciles de razonar, de comparar y de enviar entre tareas.'),
          h('¿Cuándo usar una clase?'),
          list([
            'Necesitas **identidad**: dos instancias con los mismos datos siguen siendo cosas distintas (un ViewModel, una conexión, una caché).',
            'Necesitas **estado compartido y mutable** que varias partes observen: un modelo `@Observable` (Observation solo funciona con clases).',
            'Interoperas con APIs que lo exigen (Objective-C, `NSObject`, delegados de UIKit).',
            'Márcala `final` salvo que diseñes para herencia: comunica la intención y permite al compilador usar despacho estático.'
          ]),
          compare('swift', S`
            class BookModel {
                var id: String
                var title: String
                var isFavorite: Bool

                init(id: String, title: String, isFavorite: Bool) {
                    self.id = id
                    self.title = title
                    self.isFavorite = isFavorite
                }
            }
          `, S`
            struct BookSummary: Identifiable, Hashable, Sendable {
                let id: String
                let title: String
                var isFavorite: Bool
            }

            // init memberwise, == y hash(into:) los genera el compilador
          `, {
            bad: 'Una clase para datos: escribes el `init` a mano, no tienes `==` ni `Hashable` gratis y cualquiera que tenga la referencia puede mutarla.',
            good: 'Un struct con `let` para lo que no cambia: init memberwise, `Equatable`/`Hashable` sintetizados y `Sendable` sin esfuerzo.'
          }),
          h('`let`, `var` y `mutating`'),
          p('En un struct, `let` congela el valor completo: no puedes cambiar ninguna propiedad aunque esté declarada con `var`. Los métodos que modifican el struct se marcan `mutating`, lo que deja a la vista exactamente dónde cambia el estado.'),
          code('swift', S`
            struct Cart {
                private(set) var items: [String] = []

                mutating func add(_ item: String) {
                    items.append(item)
                }
            }

            let empty = Cart()
            // empty.add("Dune")    // error: 'empty' es una constante

            var cart = Cart()
            cart.add("Dune")        // correcto
          `),
          h('Copy-on-write: copiar es barato'),
          p('Las colecciones de la librería estándar (`Array`, `Dictionary`, `Set`, `String`) usan *copy-on-write*: la copia comparte el almacenamiento hasta que una de las dos se modifica. Por eso pasar arrays grandes por valor no es un problema de rendimiento en la práctica, y tus structs heredan ese comportamiento cuando sus propiedades son colecciones.'),
          p('Si todas sus propiedades lo permiten, el compilador genera `Equatable`, `Hashable` y `Codable` por ti. Añade `Identifiable` (con un `id` estable) para usar el tipo en `List` y `ForEach` sin pasar `id:`. Y si sus propiedades son `Sendable`, el struct también lo es: puede cruzar entre tareas y actores sin avisos de Swift 6.'),
          note('kmp', 'Kotlin te entrega clases, no structs', 'Las clases del módulo compartido (incluidas las `data class`) llegan a Swift como **clases**: tipos referencia, sin `Sendable` y con tipos como `Int32` o `KotlinInt?`. No las propagues a vistas y ViewModels: conviértelas en structs Swift en la [capa adaptadora](#/l/capa-adaptadora).'),
          keys([
            'Por defecto, `struct` con `let`; `var` solo en lo que debe cambiar.',
            '`final class` cuando necesites identidad o estado compartido observable (ViewModels `@Observable`).',
            '`mutating` deja a la vista dónde cambia un valor; un `let` lo congela entero.',
            'Copy-on-write hace que copiar colecciones sea barato.',
            'Los modelos de Kotlin se mapean a structs Swift `Sendable` en la frontera.'
          ]),
        ],
        quiz: [
          q('¿Qué tipo usarías para el modelo de un libro que se muestra en una lista?',
            ['`final class Book: ObservableObject`', 'El tipo `Book` de Kotlin tal cual', '`struct BookSummary: Identifiable, Hashable, Sendable`', '`class Book: NSObject`'],
            2, 'Es un dato: un struct con semántica de valor, conformancias sintetizadas, `Identifiable` para `List`/`ForEach` y `Sendable` para cruzar entre tareas.'),
          q('Tienes `let cart = Cart()` (un struct) y llamas a `cart.add("Dune")`, un método `mutating`. ¿Qué ocurre?',
            ['Error de compilación: un struct en `let` no se puede mutar', 'Funciona: `let` solo congela la referencia', 'Compila, pero falla en ejecución', 'Se crea una copia mutada que se descarta'],
            0, 'En un struct, `let` hace inmutable el valor completo, así que no puedes llamar a métodos `mutating` sobre él.'),
          q('¿Qué aporta marcar una clase como `final`?',
            ['La hace `Sendable` automáticamente', 'Es obligatorio para usarla en SwiftUI', 'Impide instanciarla más de una vez', 'Documenta que no está pensada para herencia y permite despacho estático'],
            3, '`final` impide las subclases: documenta la intención y permite al compilador optimizar las llamadas. No la hace `Sendable` por sí sola.'),
          q('Pasas por valor un `Array` de 10.000 elementos a una función que solo lo lee. ¿Cuánto cuesta?',
            ['Se copian los 10.000 elementos', 'Casi nada: copy-on-write comparte el almacenamiento mientras nadie escriba', 'Depende de si los elementos son clases', 'Swift lo convierte en referencia y deja de ser un valor'],
            1, 'Las colecciones estándar usan copy-on-write: la copia real solo se produce si una de las dos se modifica.'),
        ],
      },

      // ---------------------------------------------------------------------
      {
        id: 'opcionales',
        title: 'Opcionales sin force unwrap',
        level: 'Básico',
        minutes: 8,
        tags: ['Optional', 'if let', 'guard let', '??', 'force unwrap'],
        summary: 'Las herramientas para desenvolver opcionales con seguridad y por qué el ! es una apuesta.',
        blocks: [
          p('`Optional` es un enum con dos casos: `.none` y `.some(valor)`. Kotlin tiene tipos nullable parecidos, pero Swift te da más herramientas para desenvolverlos de forma segura. La regla: **un `!` es una afirmación de que estás seguro al 100 %**, y si te equivocas, la app se cierra.'),
          h('Las herramientas'),
          code('swift', S`
            struct Author { let name: String }

            struct Book {
                let title: String
                let subtitle: String?
                let author: Author?
                let year: Int?
                let coverPath: String?
            }

            func summary(of book: Book) -> String {
                guard let author = book.author else {          // guard let: sal pronto
                    return book.title
                }
                var text = "\(book.title) · \(author.name)"
                if let subtitle = book.subtitle {               // if let
                    text += ": \(subtitle)"
                }
                let year = book.year.map(String.init) ?? "s. f."  // map + ??
                return text + " (\(year))"
            }

            func coverURL(of book: Book) -> URL? {
                book.coverPath.flatMap(URL.init(string:))       // String? → URL?
            }

            func authorInitial(of book: Book) -> Character? {
                book.author?.name.first                         // encadenamiento opcional
            }
          `),
          p('Con variables locales puedes usar la forma abreviada `if let subtitle { … }` (Swift 5.7+). Prefiere `guard let` cuando el resto de la función necesita el valor: mantiene el camino feliz a la izquierda, sin anidar.'),
          compare('swift', S`
            func coverURL(of book: Book) -> URL {
                URL(string: book.coverPath!)!            // dos crashes posibles
            }

            func year(from text: String) -> Int {
                Int(text)!                               // el usuario escribe "dos mil"
            }

            func author(from json: [String: Any]) -> String {
                json["author"] as! String                // el backend cambia el tipo
            }
          `, S`
            func coverURL(of book: Book) -> URL? {
                book.coverPath.flatMap(URL.init(string:))
            }

            func year(from text: String) throws(FormError) -> Int {
                guard let year = Int(text) else { throw FormError.invalidYear(text) }
                return year
            }

            func author(from json: [String: Any]) throws(DecodingFailure) -> String {
                guard let author = json["author"] as? String else {
                    throw DecodingFailure.missingField("author")
                }
                return author
            }
          `, {
            bad: 'Cada `!` y cada `as!` es un crash esperando al dato inesperado: un campo nulo, un texto mal escrito o un cambio en el backend.',
            good: 'El tipo de retorno opcional o el error obligan a decidir qué pasa cuando falta el dato, y el compilador te lo recuerda.'
          }),
          h('¿Hay algún `!` aceptable?'),
          list([
            'Un literal que sabes válido, como `URL(string: "https://example.com")!` en una constante estática con nombre. Si falla, falla siempre y lo ves en el primer arranque.',
            '`@IBOutlet` en código UIKit heredado. En SwiftUI no lo necesitas.',
            'En tests, mejor `try #require(valor)`: si es `nil`, el test falla con un mensaje claro en vez de tumbar el proceso ([Swift Testing](#/l/swift-testing)).'
          ]),
          h('Opcional no es lo mismo que «error»'),
          p('Usa `Optional` cuando la ausencia es un caso normal (un libro sin portada). Si la ausencia significa que algo ha fallado y te interesa el motivo, lanza un error o modela el estado con un enum ([Enums y errores tipados](#/l/errores-enums)). Un `nil` no explica nada.'),
          note('kmp', 'Los nullables numéricos de Kotlin llegan «en caja»', 'Con la exportación Objective-C, un `Int?` de Kotlin llega como `KotlinInt?` (una subclase de `NSNumber`) y un `Int` no opcional como `Int32`. Conviértelos en el adaptador, una sola vez: `pages = book.pageCount?.intValue` y `year = Int(book.year)`. Los `String?` y los objetos opcionales sí llegan como opcionales normales de Swift.'),
          keys([
            'Desenvuelve con `if let`, `guard let`, `??`, `?.` y `map`/`flatMap`, no con `!`.',
            '`!`, `as!` y `try!` son crashes potenciales: resérvalos para invariantes imposibles de violar.',
            '`guard let` mantiene el camino feliz sin anidar.',
            '`nil` significa «no hay», no «ha fallado»: para fallos usa errores o enums.',
            'Convierte `KotlinInt?` e `Int32` en la capa adaptadora, una sola vez.'
          ]),
        ],
        quiz: [
          q('¿Qué hace `let label = subtitle ?? "Sin subtítulo"`?',
            ['Lanza un error si `subtitle` es `nil`', 'Convierte `subtitle` en implícitamente desenvuelto', 'Compara `subtitle` con el texto', 'Usa `subtitle` si tiene valor y, si no, el texto por defecto'],
            3, '`??` (*nil-coalescing*) devuelve el valor desenvuelto o, si es `nil`, el valor por defecto.'),
          q('Una propiedad Kotlin `val pageCount: Int?`. ¿Cómo la ves en Swift con la exportación Objective-C?',
            ['`Int?`', '`Int32?`', '`KotlinInt?`', '`NSInteger`'],
            2, 'Los primitivos nullable se «encajan» en `KotlinInt`, una subclase de `NSNumber`. Conviértelo una vez en el adaptador.'),
          q('¿Qué es preferible en un test para desenvolver un opcional?',
            ['`try #require(valor)`', '`valor!`', '`valor ?? 0`', 'Un `if let` sin comprobar el caso `nil`'],
            0, '`#require` falla el test con un mensaje claro si el valor es `nil` y detiene solo ese test, sin tumbar el proceso.'),
          q('¿Cuándo tiene sentido devolver `nil` en lugar de lanzar un error?',
            ['Siempre: los errores son más lentos', 'Cuando la ausencia es un caso normal y no importa el motivo', 'Cuando falla la red', 'Nunca: los opcionales están desaconsejados'],
            1, 'Un opcional comunica «puede no haber valor». Si te interesa *por qué* ha fallado algo, lanza un error o modela un estado.'),
        ],
      },

      // ---------------------------------------------------------------------
      {
        id: 'protocolos',
        title: 'Protocolos, genéricos, some y any',
        level: 'Intermedio',
        minutes: 12,
        tags: ['protocol', 'some', 'any', 'genéricos', 'extensiones', 'inyección'],
        summary: 'Protocolos como contratos intercambiables y cuándo usar some, genéricos o any.',
        blocks: [
          p('Los protocolos son la herramienta principal de abstracción en Swift: describen capacidades, permiten implementaciones intercambiables (la real, un fake para previews, un spy para tests) y sustituyen a casi todo lo que en otros lenguajes harías con herencia.'),
          h('Un protocolo como contrato'),
          code('swift', S`
            protocol BookCatalog: Sendable {
                func books() async throws -> [BookSummary]
                func book(id: String) async throws -> BookSummary
            }

            enum CatalogError: Error { case notFound }

            struct InMemoryCatalog: BookCatalog {
                let items: [BookSummary]

                func books() async throws -> [BookSummary] { items }

                func book(id: String) async throws -> BookSummary {
                    guard let book = items.first(where: { $0.id == id }) else {
                        throw CatalogError.notFound
                    }
                    return book
                }
            }
          `, 'Un contrato y una implementación en memoria'),
          compare('swift', S`
            @MainActor
            @Observable
            final class CatalogViewModel {
                // Acoplado a la implementación real: red, KMP, todo
                private let catalog = RemoteCatalog()

                var books: [BookSummary] = []

                func load() async {
                    books = (try? await catalog.books()) ?? []
                }
            }
          `, S`
            @MainActor
            @Observable
            final class CatalogViewModel {
                private let catalog: any BookCatalog   // contrato, no implementación

                var books: [BookSummary] = []

                init(catalog: any BookCatalog) {
                    self.catalog = catalog
                }

                func load() async {
                    do {
                        books = try await catalog.books()
                    } catch {
                        // gestiona el error: ver la lección de errores
                    }
                }
            }
          `, {
            bad: 'No puedes usar este ViewModel en una preview ni en un test sin tocar la red. Y `try?` se traga el error.',
            good: 'Depende de un protocolo: en producción recibe el adaptador real; en previews y tests, `InMemoryCatalog`.'
          }),
          h('`some` frente a `any`'),
          p('`some Protocolo` es un tipo **opaco**: un tipo concreto que el compilador conoce aunque tú no lo escribas. `any Protocolo` es un **existencial**: una caja que puede contener cualquier tipo conforme y que se resuelve en tiempo de ejecución. `some` es más eficiente y conserva la información de tipos; `any` es más flexible.'),
          table(['Usa…', 'Cuándo', 'Ejemplo'], [
            ['`some`', 'Parámetros y retornos donde el tipo concreto es uno solo', '`var body: some View`, `func titles(of books: some Collection<BookSummary>)`'],
            ['Genéricos `<T: P>`', 'Cuando necesitas relacionar tipos (el mismo `T` en varios sitios)', '`func merge<T: Hashable>(_ a: [T], _ b: [T]) -> [T]`'],
            ['`any`', 'Para almacenar una dependencia intercambiable o valores heterogéneos', '`let catalog: any BookCatalog`, `[any Analytics]`'],
          ]),
          code('swift', S`
            // Equivale a: func titles<C: Collection>(of books: C) -> [String]
            //             where C.Element == BookSummary
            func titles(of books: some Collection<BookSummary>) -> [String] {
                books.map(\.title)
            }

            titles(of: [dune, earthsea])          // Array
            titles(of: Set([dune, earthsea]))     // Set
          `, 'Tipos asociados primarios (Swift 5.7+)'),
          p('`Collection<BookSummary>` funciona porque `Collection` declara `Element` como tipo asociado **primario**. Puedes hacer lo mismo en tus protocolos: `protocol Store<Item> { associatedtype Item }`.'),
          h('Extensiones de protocolo: implementaciones por defecto'),
          code('swift', S`
            protocol Analytics: Sendable {
                func track(_ event: String, properties: [String: String])
            }

            extension Analytics {
                // Una ayuda, no un requisito: todos los tipos la heredan
                func track(_ event: String) {
                    track(event, properties: [:])
                }
            }

            struct ConsoleAnalytics: Analytics {
                func track(_ event: String, properties: [String: String]) {
                    print("evento:", event, properties)
                }
            }
          `),
          note('warn', 'Cuidado con el despacho estático', 'Un método que solo existe en la extensión (no está declarado en el protocolo) se resuelve según el **tipo estático**. Si un tipo lo «sobrescribe» y lo llamas a través de `any Analytics`, se ejecuta la versión de la extensión. Si quieres que cada tipo pueda personalizarlo, decláralo también como requisito del protocolo.'),
          p('**Composición en lugar de herencia.** En Swift casi nunca necesitas jerarquías de clases: combina protocolos pequeños (`Identifiable & Hashable`, `BookCatalog & FavoritesStore`) y structs. Si un protocolo empieza a tener diez requisitos, probablemente son dos o tres protocolos distintos.'),
          note('kmp', 'Las interfaces Kotlin no son tus protocolos', 'Una `interface` de Kotlin llega a Swift como protocolo Objective-C: sin genéricos (un `Repository<T>` pierde el `T`), con tipos como `KotlinInt` y con nombres de Kotlin. No hagas que tus ViewModels dependan de ellas: define **tus** protocolos Swift (como `LibraryService`) y deja que la [capa adaptadora](#/l/capa-adaptadora) los implemente con los casos de uso de KMP.'),
          keys([
            'Define las dependencias como protocolos pequeños: permiten fakes en previews y tests.',
            'Prefiere `some` y genéricos; usa `any` para almacenar dependencias o colecciones heterogéneas.',
            'Los tipos asociados primarios permiten escribir `some Collection<BookSummary>`.',
            'Lo que solo está en una extensión de protocolo usa despacho estático.',
            'Tus ViewModels dependen de protocolos Swift, nunca de interfaces Kotlin.'
          ]),
        ],
        quiz: [
          q('¿Qué diferencia hay entre `some View` y `any View`?',
            ['Ninguna: son sinónimos', '`any` es más rápido porque evita los genéricos', '`some` es un tipo concreto oculto que el compilador conoce; `any` es una caja que resuelve el tipo en ejecución', '`some` solo funciona con clases'],
            2, 'El tipo opaco (`some`) es uno solo y conocido en compilación; el existencial (`any`) puede contener cualquier tipo conforme y añade una indirección en ejecución.'),
          q('Un ViewModel guarda una dependencia que en producción es el adaptador KMP y en tests un fake. ¿Qué tipo usas para la propiedad?',
            ['`let service: KMPLibraryService`', '`let service: any LibraryService`', '`let service: some LibraryService`', '`let service: AnyObject`'],
            1, 'Para inyectar implementaciones distintas, el existencial `any` es lo natural. Un `some` almacenado queda fijado a un único tipo concreto (la alternativa sería hacer genérico el ViewModel, con más ruido).'),
          q('Una `interface Repository<T>` de Kotlin se exporta a Swift vía Objective-C. ¿Qué pasa con `T`?',
            ['Se pierde: la exportación Objective-C solo conserva genéricos en clases', 'Se convierte en un tipo asociado', 'Swift lo infiere al usarla', 'Se convierte en un tipo asociado primario'],
            0, 'Los genéricos solo sobreviven en clases; en interfaces se pierden. Otra razón para definir tus propios protocolos Swift en el adaptador.'),
          q('`track(_:)` solo existe en `extension Analytics` (no es requisito). `MockAnalytics` define su propio `track(_:)`. Lo llamas a través de `let a: any Analytics = MockAnalytics()`. ¿Qué se ejecuta?',
            ['La versión de `MockAnalytics`', 'Error de compilación por ambigüedad', 'Ninguna: se lanza una excepción', 'La versión de la extensión del protocolo'],
            3, 'Al no ser requisito del protocolo, la llamada se resuelve estáticamente según el tipo `any Analytics`, que solo conoce la versión de la extensión.'),
        ],
      },

      // ---------------------------------------------------------------------
      {
        id: 'errores-enums',
        title: 'Enums con valores asociados y errores tipados',
        level: 'Intermedio',
        minutes: 12,
        tags: ['enum', 'switch', 'throws', 'typed throws', 'LocalizedError', 'try?'],
        summary: 'Modela estados sin combinaciones imposibles y gestiona los fallos con errores declarados.',
        blocks: [
          p('Dos herramientas que cambian cómo modelas una app: los **enums con valores asociados**, para representar estados sin combinaciones imposibles, y los **errores declarados** (`throws`), para que ningún fallo pase desapercibido.'),
          h('Haz imposibles los estados imposibles'),
          compare('swift', S`
            @MainActor
            @Observable
            final class BooksViewModel {
                var isLoading = false
                var books: [BookSummary] = []
                var errorMessage: String?
                // ¿isLoading y errorMessage a la vez?
                // ¿books vacío porque no hay libros o porque falló?
            }
          `, S`
            @MainActor
            @Observable
            final class BooksViewModel {
                enum State: Equatable {
                    case loading
                    case loaded([BookSummary])
                    case empty
                    case failed(LibraryFailure)
                }

                private(set) var state: State = .loading
            }
          `, {
            bad: 'Tres propiedades independientes permiten 2 × 2 × 2 combinaciones; la mayoría no tienen sentido y la vista tiene que adivinar cuál manda.',
            good: 'Un único `enum`: cada caso lleva exactamente los datos que necesita y la vista hace un `switch` exhaustivo.'
          }),
          code('swift', S`
            struct BooksView: View {
                let viewModel: BooksViewModel

                var body: some View {
                    switch viewModel.state {
                    case .loading:
                        ProgressView()
                    case .loaded(let books):
                        List(books) { BookRow(book: $0) }
                    case .empty:
                        ContentUnavailableView("Sin libros", systemImage: "books.vertical")
                    case .failed(let failure):
                        ErrorView(failure: failure)
                    }
                }
            }
          `, 'La vista no adivina: hace un switch'),
          note('tip', 'Evita `default` cuando quieras ayuda del compilador', 'Con un `switch` exhaustivo, si mañana añades `case offline`, el compilador te señala todos los sitios que deben manejarlo. Un `default:` silencia ese aviso para siempre.'),
          h('Errores: `throws`, `try` y `do/catch`'),
          code('swift', S`
            enum LibraryFailure: Error, Equatable {
                case offline
                case notFound
                case server(code: Int)
                case unknown(String)
                case cancelled
            }

            func openBook(id: String) async {
                do {
                    let book = try await loader.book(id: id)
                    show(book)
                } catch LibraryFailure.offline {
                    showOfflineBanner()
                } catch {
                    show(error)
                }
            }
          `),
          h('Errores tipados: `throws(E)`'),
          p('Desde Swift 6 puedes declarar **qué** error lanza una función: `throws(LibraryFailure)`. Quien llama recibe un `LibraryFailure`, no un `any Error`, y puede hacer un `switch` exhaustivo. Úsalo en fronteras con un conjunto de errores cerrado y estable (como la capa adaptadora con KMP) o en código interno; en APIs públicas que pueden evolucionar, el `throws` sin tipo sigue siendo la opción flexible.'),
          code('swift', S`
            protocol LibraryService: Sendable {
                func refresh() async throws(LibraryFailure)
            }

            // BooksViewModel guarda 'private let service: any LibraryService'
            extension BooksViewModel {
                func refresh() async {
                    do throws(LibraryFailure) {
                        try await service.refresh()
                    } catch {
                        switch error {               // error es LibraryFailure
                        case .cancelled:
                            return                   // la vista desapareció: nada que mostrar
                        case .offline, .notFound, .server, .unknown:
                            state = .failed(error)
                        }
                    }
                }
            }
          `),
          p('Con `do throws(LibraryFailure)` el tipo del error dentro del `catch` queda explícito y no dependes de la inferencia del compilador.'),
          h('`try?` solo a propósito'),
          compare('swift', S`
            func toggleFavorite(_ book: BookSummary) async {
                try? await service.setFavorite(!book.isFavorite, for: book.id)
                // Si falla, el usuario cree que se ha guardado
            }
          `, S`
            func toggleFavorite(_ book: BookSummary) async {
                do throws(LibraryFailure) {
                    try await service.setFavorite(!book.isFavorite, for: book.id)
                } catch {
                    alert = .favoriteNotSaved(error)
                }
            }

            // try? solo cuando descartar el error es una decisión consciente:
            try? FileManager.default.removeItem(at: temporaryExport)
          `, {
            bad: '`try?` convierte el fallo en `nil` y lo descarta: ni el usuario ni tú os enteráis.',
            good: 'Gestiona el error donde puedas hacer algo útil con él. `try?` queda para cuando de verdad te da igual el resultado.'
          }),
          h('Mensajes para el usuario: `LocalizedError`'),
          code('swift', S`
            extension LibraryFailure: LocalizedError {
                var errorDescription: String? {
                    switch self {
                    case .offline:
                        String(localized: "Sin conexión. Mostrando los datos guardados.")
                    case .notFound:
                        String(localized: "Ese libro ya no está disponible.")
                    case .server(let code):
                        String(localized: "El servidor ha fallado (\(code)). Inténtalo más tarde.")
                    case .unknown, .cancelled:
                        String(localized: "Algo ha ido mal.")
                    }
                }
            }
          `),
          note('kmp', 'Las excepciones de Kotlin no son errores de Swift', 'Una excepción lanzada desde el módulo compartido solo llega a Swift como `Error` si la función la declara con `@Throws`. Si no, **la app se cierra**. Por eso el adaptador captura todo lo que viene de Kotlin y lo traduce a un enum Swift como `LibraryFailure`. Lo ves en detalle en [Sealed classes, enums y errores](#/l/sealed-errores).'),
          keys([
            'Modela el estado de una pantalla con un `enum` con valores asociados, no con varios booleanos.',
            'Un `switch` exhaustivo sin `default` hace que el compilador te avise cuando aparece un caso nuevo.',
            '`throws(E)` (Swift 6) da errores exhaustivos en fronteras con un conjunto cerrado de fallos.',
            '`try?` solo cuando descartar el error es una decisión consciente.',
            'Traduce las excepciones de Kotlin a errores Swift en el adaptador.'
          ]),
        ],
        quiz: [
          q('¿Por qué un `enum State` es mejor que `isLoading` + `errorMessage` + `books`?',
            ['Impide combinaciones sin sentido y obliga a la vista a tratar cada caso', 'Ocupa menos memoria', 'SwiftUI no puede observar booleanos', 'Es obligatorio con `@Observable`'],
            0, 'Cada caso lleva solo sus datos y el `switch` exhaustivo garantiza que la vista contempla todos los estados.'),
          q('Con `func refresh() async throws(LibraryFailure)`, ¿qué ganas frente a `throws` sin tipo?',
            ['Nada, es solo documentación', 'Ya no hace falta capturar el error', 'Quien llama recibe un `LibraryFailure` y puede hacer un `switch` exhaustivo', 'La función deja de ser `async`'],
            2, 'Con errores tipados el compilador conoce el tipo exacto del error: `switch` exhaustivo sin casts ni `default`.'),
          q('Una función Kotlin `suspend fun load(): Book` lanza `IOException` y no tiene `@Throws`. La llamas desde Swift y se produce la excepción. ¿Qué pasa?',
            ['Llega como `Error` a tu `catch`', 'Devuelve `nil`', 'Se reintenta automáticamente', 'La app se cierra'],
            3, 'Sin `@Throws`, las funciones `suspend` solo propagan `CancellationException`. Cualquier otra excepción que llegue a Swift se considera no gestionada y termina el proceso.'),
          q('¿Cuándo es aceptable `try?`?',
            ['En todas las llamadas al módulo KMP', 'Cuando descartar el fallo es una decisión consciente, como borrar un fichero temporal que quizá no existe', 'Siempre que la llamada sea `async`', 'Cuando no quieres escribir `do/catch`'],
            1, '`try?` descarta el error. Úsalo solo cuando el resultado de verdad no importa; si el usuario espera algo, gestiona el fallo.'),
        ],
      },
    ],
  });
})();
