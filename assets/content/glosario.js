(function () {
  'use strict';

  Curso.glossary([
    // ------------------------------------------------------------------ Swift
    {
      term: 'struct',
      category: 'Swift',
      md: 'Tipo de valor: se copia al asignarlo. Es la opción por defecto para modelos y datos inmutables.',
      kotlin: '`data class`',
      swift: '`struct BookSummary: Hashable, Sendable`',
      lesson: 'tipos-valor'
    },
    {
      term: 'Optional',
      category: 'Swift',
      md: 'Enum con dos casos, `.none` y `.some(valor)`, que representa la posible ausencia de un valor. Se desenvuelve con `if let`, `guard let`, `??` o `?.`, nunca con `!` por costumbre.',
      kotlin: '`T?`',
      swift: '`T?` (`Optional<T>`)',
      lesson: 'opcionales'
    },
    {
      term: 'protocol',
      category: 'Swift',
      md: 'Contrato de requisitos (métodos, propiedades, tipos asociados). Es la base de la abstracción y de la inyección de dependencias en Swift.',
      kotlin: '`interface`',
      swift: '`protocol LibraryService: Sendable`',
      lesson: 'protocolos'
    },
    {
      term: 'some (tipo opaco)',
      category: 'Swift',
      md: 'Un tipo concreto que el compilador conoce aunque no lo escribas, como en `some View`. Es eficiente y conserva la información de tipos.',
      swift: '`func titles(of books: some Collection<BookSummary>)`',
      lesson: 'protocolos'
    },
    {
      term: 'any (existencial)',
      category: 'Swift',
      md: 'Una caja que puede contener cualquier tipo conforme a un protocolo y que se resuelve en ejecución. Útil para guardar dependencias intercambiables.',
      swift: '`let service: any LibraryService`',
      lesson: 'protocolos'
    },
    {
      term: 'enum con valores asociados',
      category: 'Swift',
      md: 'Enum cuyos casos llevan datos. Modela estados y resultados cerrados, y el `switch` exhaustivo obliga a tratar todos los casos.',
      kotlin: '`sealed class` / `sealed interface`',
      swift: '`case loaded([BookSummary])`',
      lesson: 'errores-enums'
    },
    {
      term: 'Errores tipados',
      category: 'Swift',
      md: 'Swift 6 permite declarar el tipo concreto de error que lanza una función. Quien llama recibe ese tipo y puede hacer un `switch` exhaustivo.',
      swift: '`func refresh() async throws(LibraryFailure)`',
      lesson: 'errores-enums'
    },
    {
      term: 'Swift API Design Guidelines',
      category: 'Swift',
      md: 'Guía oficial de nombres: claridad en el punto de uso, etiquetas de argumento con significado, sin prefijo `get` y booleanos que se leen como afirmaciones (`isEmpty`).',
      swift: '`repository.book(id: "42")`',
      lesson: 'kotlin-a-swift'
    },
    {
      term: 'Selector de módulo',
      category: 'Swift',
      md: 'Disponible con Xcode 27: indica de qué módulo es un nombre para resolver colisiones, por ejemplo entre un tipo exportado por KMP y uno de tu app con el mismo nombre.',
      swift: '`Shared::Book`',
      lesson: 'kotlin-desde-swift'
    },

    // ----------------------------------------------------------- Concurrencia
    {
      term: 'async / await',
      category: 'Concurrencia',
      md: 'Funciones que pueden suspenderse sin bloquear el hilo; `await` marca cada punto de suspensión.',
      kotlin: '`suspend fun`',
      swift: '`func book(id: String) async throws -> BookSummary`',
      lesson: 'async-await'
    },
    {
      term: 'Task',
      category: 'Concurrencia',
      md: 'Unidad de trabajo asíncrono. Una `Task { }` no estructurada hereda el actor de quien la crea, pero no se cancela sola: guárdala si necesitas cancelarla.',
      kotlin: '`scope.launch { }` (`Job`)',
      swift: '`Task { await upload() }`',
      lesson: 'async-await'
    },
    {
      term: 'Concurrencia estructurada',
      category: 'Concurrencia',
      md: 'Las tareas hijas (`async let`, *task groups*) terminan antes que su padre, heredan su cancelación y propagan sus errores.',
      kotlin: '`coroutineScope { }` + `async { }`',
      swift: '`async let` / `withThrowingTaskGroup`',
      lesson: 'async-await'
    },
    {
      term: 'Cancelación cooperativa',
      category: 'Concurrencia',
      md: 'Cancelar solo marca la tarea; el código debe comprobarlo o usar APIs que lancen `CancellationError`.',
      kotlin: '`ensureActive()` / `isActive`',
      swift: '`try Task.checkCancellation()` / `Task.isCancelled`',
      lesson: 'async-await'
    },
    {
      term: '@MainActor',
      category: 'Concurrencia',
      md: 'Actor global del hilo principal. Aísla vistas, ViewModels y todo lo que toca la UI; el compilador lo comprueba.',
      kotlin: '`Dispatchers.Main`',
      swift: '`@MainActor @Observable final class LibraryViewModel`',
      lesson: 'aislamiento'
    },
    {
      term: 'actor',
      category: 'Concurrencia',
      md: 'Tipo referencia que serializa el acceso a su estado mutable. Evita las data races, pero es reentrante en cada `await`.',
      kotlin: '`Mutex` o confinamiento a un hilo',
      swift: '`actor ImageCache { … }`',
      lesson: 'aislamiento'
    },
    {
      term: 'Sendable',
      category: 'Concurrencia',
      md: 'Marca los tipos que pueden cruzar dominios de aislamiento sin data races: structs y enums con propiedades `Sendable`, actores y clases inmutables.',
      swift: '`struct BookSummary: Sendable`',
      lesson: 'aislamiento'
    },
    {
      term: 'Data race',
      category: 'Concurrencia',
      md: 'Dos accesos simultáneos a la misma memoria en los que al menos uno escribe. En el modo de lenguaje Swift 6 son errores de compilación.',
      lesson: 'aislamiento'
    },
    {
      term: '@preconcurrency import',
      category: 'Concurrencia',
      md: 'Rebaja los diagnósticos de `Sendable` para los tipos de un módulo no auditado, como el framework KMP. Úsalo en el adaptador, no por toda la app.',
      swift: '`@preconcurrency import Shared`',
      lesson: 'aislamiento'
    },
    {
      term: 'Approachable Concurrency',
      category: 'Concurrencia',
      md: 'Ajuste de Swift 6.2+ que activa varias mejoras de usabilidad; la principal, que las funciones `async` no aisladas se ejecuten en el actor de quien las llama.',
      lesson: 'approachable'
    },
    {
      term: 'Default Actor Isolation',
      category: 'Concurrencia',
      md: 'Ajuste de Swift 6.2+ (SE-0466) que hace `@MainActor` todo el código sin anotar de un módulo. Viene activado en los proyectos de app nuevos de Xcode 26+.',
      lesson: 'approachable'
    },
    {
      term: 'nonisolated',
      category: 'Concurrencia',
      md: 'Indica que una declaración no pertenece a ningún actor. Con el aislamiento por defecto en `MainActor`, se usa en modelos, errores, mapeos y adaptadores.',
      swift: '`nonisolated struct BookSummary`',
      lesson: 'approachable'
    },
    {
      term: '@concurrent',
      category: 'Concurrencia',
      md: 'Swift 6.2+: marca una función `async` que debe ejecutarse fuera del actor, en el pool concurrente. Para trabajo pesado de CPU.',
      kotlin: '`withContext(Dispatchers.Default)`',
      swift: '`@concurrent nonisolated func decode(_ data: Data) async throws`',
      lesson: 'approachable'
    },
    {
      term: 'AsyncSequence',
      category: 'Concurrencia',
      md: 'Secuencia de valores que llegan con el tiempo y se recorren con `for await`, normalmente dentro de `.task`.',
      kotlin: '`Flow<T>`',
      swift: '`for await books in service.books() { … }`',
      lesson: 'async-sequence'
    },
    {
      term: 'AsyncStream',
      category: 'Concurrencia',
      md: 'Implementación concreta de `AsyncSequence` que alimentas con una *continuation*. Sirve para puentear callbacks y delegados; limpia en `onTermination`.',
      kotlin: '`callbackFlow { }`',
      swift: '`AsyncStream.makeStream(of: Status.self)`',
      lesson: 'async-sequence'
    },
    {
      term: 'Observations',
      category: 'Concurrencia',
      md: 'Swift 6.2 (iOS 26+): `AsyncSequence` que emite cada vez que cambian las propiedades `@Observable` leídas en su closure.',
      kotlin: '`snapshotFlow { }` (Compose)',
      swift: '`Observations { viewModel.query }`',
      lesson: 'async-sequence'
    },

    // ---------------------------------------------------------------- SwiftUI
    {
      term: '@Observable',
      category: 'SwiftUI',
      md: 'Macro del framework Observation (iOS 17+). SwiftUI observa solo las propiedades que lee cada vista, sin `@Published`.',
      kotlin: '`StateFlow` + `collectAsState()`',
      swift: '`@Observable final class LibraryViewModel`',
      lesson: 'estado'
    },
    {
      term: '@State',
      category: 'SwiftUI',
      md: 'Estado propiedad de la vista; vive mientras la vista conserve su identidad. Con Xcode 27 es una macro y evalúa el valor inicial de forma perezosa.',
      kotlin: '`remember { mutableStateOf(…) }`',
      swift: '`@State private var viewModel: LibraryViewModel`',
      lesson: 'estado'
    },
    {
      term: '@Bindable',
      category: 'SwiftUI',
      md: 'Permite crear bindings (`$modelo.propiedad`) a un objeto `@Observable` que la vista recibe pero no posee.',
      swift: '`@Bindable var viewModel: LibraryViewModel`',
      lesson: 'estado'
    },
    {
      term: '@Environment',
      category: 'SwiftUI',
      md: 'Lee valores u objetos inyectados en la jerarquía de vistas con `.environment(_:)`.',
      kotlin: '`CompositionLocal`',
      swift: '`@Environment(Router.self) private var router`',
      lesson: 'estado'
    },
    {
      term: '.task(id:)',
      category: 'SwiftUI',
      md: 'Ejecuta trabajo asíncrono ligado a la vida de la vista: lo cancela al desaparecer y lo reinicia cuando cambia el `id`.',
      kotlin: '`LaunchedEffect(key)`',
      swift: '`.task(id: viewModel.query) { await viewModel.search() }`',
      lesson: 'ciclo-vida'
    },
    {
      term: 'Identidad de vista',
      category: 'SwiftUI',
      md: 'Cómo reconoce SwiftUI que una vista es «la misma» entre actualizaciones: por su posición en la estructura o por un `id` explícito. Si cambia, se pierde su `@State`.',
      kotlin: '`key(…) { }`',
      swift: '`ForEach(books) { … }` con `Identifiable`',
      lesson: 'composicion'
    },
    {
      term: 'NavigationStack',
      category: 'SwiftUI',
      md: 'Contenedor de navegación con una pila tipada (`path`) y destinos declarados por tipo con `navigationDestination(for:)`.',
      kotlin: '`NavHost` (Navigation Compose)',
      swift: '`NavigationStack(path: $router.path)`',
      lesson: 'navegacion'
    },
    {
      term: '#Preview',
      category: 'SwiftUI',
      md: 'Macro para declarar previews en Xcode. Combinada con fakes, enseña todos los estados de una pantalla sin ejecutar KMP (y, si la vista vive en un paquete que no depende de `Shared`, sin compilarlo ni enlazarlo).',
      kotlin: '`@Preview`',
      swift: '`#Preview("Sin conexión") { … }`',
      lesson: 'previews'
    },

    // -------------------------------------------------------------------- KMP
    {
      term: 'Kotlin Multiplatform (KMP)',
      category: 'KMP',
      md: 'Tecnología de JetBrains para compartir código Kotlin entre Android, iOS y otras plataformas. En este curso comparte el dominio y los datos; la UI es nativa.',
      lesson: 'arquitectura'
    },
    {
      term: 'Caso de uso',
      category: 'KMP',
      md: 'Clase del dominio compartido que encapsula una operación de negocio. Si usa `operator fun invoke`, desde Swift se llama con `.invoke(…)`.',
      kotlin: '`class GetBookUseCase`',
      swift: '`try await getBook.invoke(id: id)`',
      lesson: 'arquitectura'
    },
    {
      term: 'Framework Shared',
      category: 'KMP',
      md: 'El binario (framework o XCFramework) que genera el módulo KMP para iOS y que importas en Swift. En este curso solo lo importa la capa adaptadora.',
      swift: '`import Shared`',
      lesson: 'integracion-xcode'
    },
    {
      term: 'Exportación Objective-C',
      category: 'KMP',
      md: 'Mecanismo clásico de Kotlin/Native: genera cabeceras Objective-C que Swift importa. Limita los genéricos, los enums, las sealed classes y las corrutinas.',
      lesson: 'kotlin-desde-swift'
    },
    {
      term: 'KotlinInt / KotlinUnit',
      category: 'KMP',
      md: 'Tipos puente de la exportación Objective-C: los primitivos nullable o dentro de genéricos llegan «en caja» (subclases de `NSNumber`) y `Unit` en genéricos y closures llega como `KotlinUnit`.',
      kotlin: '`Int?` / `Unit`',
      swift: '`KotlinInt?` / `KotlinUnit`',
      lesson: 'kotlin-desde-swift'
    },
    {
      term: 'Swift export',
      category: 'KMP',
      md: 'Exportación directa de Kotlin a Swift, sin pasar por Objective-C. En Alpha desde Kotlin 2.4.0 (`suspend` → `async`, `Flow` → `AsyncSequence`); las sealed classes llegan con Kotlin 2.4.20.',
      lesson: 'puentes'
    },
    {
      term: 'SKIE',
      category: 'KMP',
      md: 'Plugin de Touchlab que mejora la API Swift generada: enums y sealed exhaustivos, `suspend` con cancelación en los dos sentidos y `Flow` como `AsyncSequence`. Comprueba su compatibilidad con tu versión de Kotlin.',
      lesson: 'puentes'
    },
    {
      term: 'KMP-NativeCoroutines',
      category: 'KMP',
      md: 'Librería para consumir `suspend` y `Flow` desde Swift (async/await, Combine o RxSwift) a partir de anotaciones `@NativeCoroutines`.',
      swift: '`try await asyncFunction(for: repository.books())`',
      lesson: 'puentes'
    },
    {
      term: '@Throws',
      category: 'KMP',
      md: 'Anotación de Kotlin que declara qué excepciones pueden llegar a Swift como `Error`. Sin ella, la excepción cierra la app. En funciones `suspend` debe incluir `CancellationException` (o una superclase).',
      kotlin: '`@Throws(LibraryException::class, CancellationException::class)`',
      swift: '`throws`',
      lesson: 'sealed-errores'
    },
    {
      term: 'onEnum(of:)',
      category: 'KMP',
      md: 'Función que genera SKIE para hacer un `switch` exhaustivo sobre una sealed class o sealed interface de Kotlin.',
      kotlin: '`when (error) { is Offline -> … }`',
      swift: '`switch onEnum(of: error) { case .offline: … }`',
      lesson: 'sealed-errores'
    },
    {
      term: 'kotlinException',
      category: 'KMP',
      md: 'Propiedad que Kotlin/Native añade a `NSError` para recuperar la excepción Kotlin original dentro de un `catch`.',
      swift: '`(error as NSError).kotlinException as? LibraryException`',
      lesson: 'sealed-errores'
    },
    {
      term: 'Capa adaptadora',
      category: 'KMP',
      md: 'Código Swift que implementa tus protocolos usando los casos de uso de KMP y traduce modelos y errores a tipos Swift `Sendable`. Es el único sitio que importa `Shared`.',
      swift: '`final class KMPLibraryService: LibraryService`',
      lesson: 'capa-adaptadora'
    },
    {
      term: 'Composition root',
      category: 'KMP',
      md: 'Punto único, normalmente la `App`, donde se crean las dependencias (incluido el contenedor KMP) y desde donde se inyectan por `init`.',
      kotlin: 'Módulos de Koin o Hilt',
      swift: '`AppDependencies`',
      lesson: 'dependencias'
    },
    {
      term: 'expect / actual',
      category: 'KMP',
      md: 'Mecanismo de KMP para declarar una API común con una implementación por plataforma. Para servicios que Swift implementa mejor (Keychain, analítica), suele preferirse una `interface` que Swift implementa y se inyecta.',
      kotlin: '`expect fun platformName(): String`',
      lesson: 'dependencias'
    },

    // ---------------------------------------------------------------- Testing
    {
      term: 'Swift Testing',
      category: 'Testing',
      md: 'Framework de tests moderno de Swift (`import Testing`): `@Test`, `#expect`, `#require`, tests parametrizados y ejecución en paralelo por defecto.',
      kotlin: '`kotlin.test` / JUnit',
      swift: '`@Test func mapsHTTPStatus()`',
      lesson: 'swift-testing'
    },
    {
      term: '#expect / #require',
      category: 'Testing',
      md: 'Aserciones de Swift Testing: `#expect` registra el fallo y continúa; `try #require` detiene el test si falla y sirve para desenvolver opcionales.',
      kotlin: '`assertEquals` / `requireNotNull`',
      swift: '`let book = try #require(books.first)`',
      lesson: 'swift-testing'
    },
    {
      term: 'Test parametrizado',
      category: 'Testing',
      md: 'Un mismo test ejecutado con varias entradas, cada una como caso independiente. Los argumentos deben ser `Sendable`.',
      kotlin: '`@ParameterizedTest` (JUnit 5)',
      swift: '`@Test(arguments: [404, 500, 503])`',
      lesson: 'swift-testing'
    },
    {
      term: 'Fake / spy',
      category: 'Testing',
      md: 'Un fake es una implementación sencilla que funciona en memoria; un spy, además, registra cómo lo han llamado. Con protocolos `Sendable`, el registro suele ser un `actor`.',
      swift: '`FakeLibraryService`',
      lesson: 'testear-viewmodels'
    },

    // ----------------------------------------------------------- Herramientas
    {
      term: 'embedAndSignAppleFrameworkForXcode',
      category: 'Herramientas',
      md: 'Tarea Gradle de la integración directa: compila el framework KMP desde una fase de *build* de Xcode y lo incrusta y firma en la app.',
      lesson: 'integracion-xcode'
    },
    {
      term: 'XCFramework',
      category: 'Herramientas',
      md: 'Paquete binario con varias arquitecturas (dispositivo y simulador). Es la forma habitual de distribuir el módulo KMP como paquete de Swift Package Manager.',
      lesson: 'integracion-xcode'
    },
    {
      term: 'SwiftPM import',
      category: 'Herramientas',
      md: 'Novedad de Kotlin 2.4: declarar paquetes Swift como dependencias del código Kotlin/Native directamente desde Gradle, sin CocoaPods.',
      lesson: 'integracion-xcode'
    },
    {
      term: 'CocoaPods',
      category: 'Herramientas',
      md: 'Gestor de dependencias clásico de iOS. Su repositorio central (trunk) pasa a ser de solo lectura el 2 de diciembre de 2026: para proyectos nuevos, usa integración directa o Swift Package Manager.',
      lesson: 'integracion-xcode'
    }
  ]);
})();
