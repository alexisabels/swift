/* Módulo 3 · SwiftUI con buenas prácticas */
(function () {
  'use strict';
  const { p, h, code, compare, note, list, table, keys, q, S } = Curso.dsl;

  Curso.module({
    id: 'swiftui',
    order: 3,
    title: 'SwiftUI con buenas prácticas',
    short: 'SwiftUI',
    icon: 'layout',
    description: 'Estado con Observation, composición e identidad, tareas ligadas al ciclo de vida, navegación tipada, previews sin KMP y calidad: rendimiento, accesibilidad y localización.',
    lessons: [
      // ─────────────────────────────────────────────────────────────────────
      {
        id: 'estado',
        title: 'Estado y flujo de datos con Observation',
        level: 'Básico',
        minutes: 12,
        tags: ['@State', '@Observable', '@Bindable', '@Binding', '@Environment', 'Observation'],
        summary: 'Quién es dueño de cada dato y qué herramienta usar en cada caso: @State, @Binding, @Observable, @Bindable y @Environment.',
        blocks: [
          p('En SwiftUI la interfaz es una función del estado: `body` describe qué pintar para los datos actuales y SwiftUI lo vuelve a evaluar cuando esos datos cambian. Casi todos los bugs raros (estado que se pierde, pantallas que no se actualizan, ViewModels duplicados) vienen de responder mal a una sola pregunta: **¿quién es el dueño de este dato?**'),
          p('Con iOS 17+ y el framework Observation la caja de herramientas es pequeña. Apréndetela bien y olvídate de `ObservableObject`, `@Published`, `@StateObject` y `@EnvironmentObject` en código nuevo.'),
          table(['Situación', 'Herramienta', 'Ejemplo'], [
            ['La vista es dueña de un valor simple', '`@State private var`', '`@State private var isEditing = false`'],
            ['La vista es dueña de un objeto (su ViewModel)', '`@State private var` + clase `@Observable`', '`@State private var viewModel: LibraryViewModel`'],
            ['Lee y escribe un valor que es del padre', '`@Binding`', '`@Binding var isOn: Bool`'],
            ['Recibe un objeto observable y solo lo lee', '`let` normal', '`let viewModel: LibraryViewModel`'],
            ['Recibe un objeto observable y necesita bindings (`$`)', '`@Bindable`', '`@Bindable var viewModel: LibraryViewModel`'],
            ['Objeto compartido por muchas vistas', '`.environment(obj)` + `@Environment(Tipo.self)`', '`@Environment(Router.self) private var router`'],
            ['Valores del sistema', '`@Environment(\\.clave)`', '`@Environment(\\.dismiss) private var dismiss`'],
          ]),
          h('El ViewModel: @Observable y @State en la vista dueña'),
          compare('swift', S`
            import Combine

            final class LibraryViewModel: ObservableObject {
                @Published var books: [BookSummary] = []
                @Published var query = ""
            }

            struct LibraryScreen: View {
                // ❌ @ObservedObject no es dueño: si el padre se
                // reevalúa, se crea otro ViewModel y pierdes el estado
                @ObservedObject var viewModel = LibraryViewModel()

                var body: some View {
                    List(viewModel.books) { book in
                        Text(book.title)
                    }
                }
            }
          `, S`
            import Observation

            @MainActor
            @Observable
            final class LibraryViewModel {
                private(set) var books: [BookSummary] = []
                var query = ""
            }

            struct LibraryScreen: View {
                // ✅ La vista es la dueña: @State conserva la instancia
                // mientras la vista mantenga su identidad
                @State private var viewModel = LibraryViewModel()

                var body: some View {
                    List(viewModel.books) { book in
                        Text(book.title)
                    }
                }
            }
          `, {
            bad: '`ObservableObject` invalida la vista entera ante cualquier cambio de un `@Published`, aunque `body` no lo use. Y `@ObservedObject` no conserva la instancia.',
            good: 'Con `@Observable`, SwiftUI solo reevalúa `body` cuando cambian las propiedades que **leyó**. `@State` guarda la instancia y `private(set)` impide que la vista mute el estado por su cuenta.'
          }),
          p('El seguimiento es fino: durante la evaluación de `body`, Observation registra qué propiedades lees. Si cambia una propiedad que esa vista no leyó, no se reevalúa. Por eso conviene que cada subvista reciba y lea solo lo que necesita.'),
          code('swift', S`
            @MainActor
            @Observable
            final class LibraryViewModel {
                enum State: Equatable {
                    case loading, empty
                    case loaded([BookSummary])
                    case failed(LibraryFailure)
                }

                private(set) var state: State = .loading     // observada
                var query = ""                                // observada

                private let service: any LibraryService      // let: nunca cambia, no se observa
                @ObservationIgnored
                private var lastRefresh: Date?                // detalle interno: no redibuja

                init(service: any LibraryService) {
                    self.service = service                    // init barato: solo dependencias
                }
            }
          `, 'Qué se observa y qué no'),
          h('@Binding y @Bindable'),
          p('`@Binding` es una referencia de lectura y escritura a un **valor** que posee otro. `@Bindable` crea bindings (`$viewModel.query`) a propiedades de un **objeto** `@Observable` que no posees. Si la vista ya tiene el objeto en `@State`, `$viewModel.query` funciona directamente.'),
          code('swift', S`
            struct FavoriteToggle: View {
                @Binding var isOn: Bool                       // el valor es del padre

                var body: some View {
                    Toggle("Favorito", isOn: $isOn)
                }
            }

            struct SearchField: View {
                @Bindable var viewModel: LibraryViewModel     // objeto ajeno, necesito $

                var body: some View {
                    TextField("Buscar título o autor", text: $viewModel.query)
                }
            }
          `),
          h('@Environment para objetos compartidos'),
          code('swift', S`
            @main
            struct LibraryApp: App {
                @State private var router = Router()

                var body: some Scene {
                    WindowGroup {
                        RootView()
                            .environment(router)               // inyecta el objeto @Observable
                    }
                }
            }

            struct BookRow: View {
                @Environment(Router.self) private var router  // lo lee cualquier descendiente
                let book: BookSummary

                var body: some View {
                    Button(book.title) {
                        router.path.append(.book(id: book.id))
                    }
                }
            }

            struct RouterStack: View {
                @Environment(Router.self) private var router

                var body: some View {
                    @Bindable var router = router              // bindings a un objeto del entorno
                    NavigationStack(path: $router.path) {
                        Text("Inicio")
                    }
                }
            }
          `),
          note('warn', 'Si falta el objeto en el entorno, crash', 'Con `@Environment(Router.self)` (tipo no opcional), si ningún ancestro llamó a `.environment(router)` la app se cae en tiempo de ejecución. Pasa mucho en previews. Si el objeto puede faltar, decláralo opcional: `@Environment(Router.self) private var router: Router?`.'),
          h('Inicializar @State desde parámetros'),
          p('Cuando el ViewModel necesita parámetros (un id, un servicio), inicializa el `@State` en el `init` de la vista. Y aplica la regla de oro: **el init del ViewModel solo guarda dependencias**. Nada de red ni de observar Flows: eso va en `.task` (lo verás en [Tareas y ciclo de vida](#/l/ciclo-vida)).'),
          code('swift', S`
            struct BookDetailScreen: View {
                @State private var viewModel: BookDetailViewModel

                init(bookID: String, service: any LibraryService) {
                    _viewModel = State(initialValue: BookDetailViewModel(bookID: bookID, service: service))
                }

                var body: some View {
                    BookDetailContent(state: viewModel.state)
                        .task { await viewModel.load() }
                }
            }
          `),
          note('new', 'Xcode 27: @State es una macro', 'Al compilar con Xcode 27, `@State` pasa a ser una macro y el valor inicial se evalúa de forma perezosa, una sola vez, cuando SwiftUI crea el almacenamiento de la vista (el comportamiento llega también a iOS 17+). Antes, `@State private var viewModel = LibraryViewModel()` ejecutaba el init del modelo cada vez que el padre recreaba la vista, aunque SwiftUI descartara las copias. Un caso que puede dejar de compilar: dar valor por defecto en la declaración **y** asignar otro en el `init`. Elige uno de los dos.'),
          note('kmp', 'El estado de la UI es Swift puro', 'No guardes objetos Kotlin (un `Book` de `Shared`) en `@State` ni los pases a las vistas. La [capa adaptadora](#/l/capa-adaptadora) los convierte en structs Swift (`BookSummary`): las vistas no importan `Shared`, las previews no arrancan KMP y el compilador puede razonar sobre `Sendable`.'),
          keys([
            'Antes de escribir un property wrapper, decide quién es el dueño del dato: esa es la única fuente de verdad.',
            '`@State private` para lo que la vista posee (valores u objetos `@Observable`); `@Binding` y `@Bindable` para lo que posee otro.',
            'En código nuevo (iOS 17+): `@Observable` en lugar de `ObservableObject`, `@Published`, `@StateObject` y `@EnvironmentObject`.',
            'Observation solo redibuja por las propiedades que `body` lee: subvistas que reciben lo justo.',
            'Init del ViewModel barato; la carga, en `.task`.',
          ]),
        ],
        quiz: [
          q('Una pantalla crea su propio `LibraryViewModel` (`@Observable`). ¿Cómo lo declaras?', [
            '`@ObservedObject var viewModel = LibraryViewModel()`',
            '`@State private var viewModel = LibraryViewModel()`',
            '`@Bindable var viewModel = LibraryViewModel()`',
            '`let viewModel = LibraryViewModel()`',
          ], 1, '`@State` hace a la vista dueña de la instancia y la conserva mientras la vista mantenga su identidad. Con `@Bindable` o `let` se crearía un ViewModel nuevo cada vez que el padre recrea la vista.'),
          q('Un hijo recibe el ViewModel como parámetro y necesita un `TextField` enlazado a `query`. ¿Qué usas?', [
            '`@Bindable var viewModel: LibraryViewModel` y `$viewModel.query`',
            '`@State var viewModel: LibraryViewModel`',
            '`@Binding var viewModel: LibraryViewModel`',
            '`@Environment(LibraryViewModel.self)` sin inyectarlo',
          ], 0, '`@Bindable` crea bindings a propiedades de un objeto `@Observable` que no te pertenece. Con `@State`, el hijo se quedaría con la primera instancia recibida e ignoraría las siguientes; `@Binding` es para valores.'),
          q('¿Qué provoca que se reevalúe `body` en una vista que usa un objeto `@Observable`?', [
            'Cualquier cambio en cualquier propiedad del objeto',
            'Los cambios en propiedades que `body` leyó en su última evaluación',
            'Solo los cambios en propiedades marcadas con `@Published`',
            'Nada: hay que llamar a `objectWillChange.send()`',
          ], 1, 'Observation registra las lecturas que hace `body` y solo invalida por esas propiedades. Es la gran mejora frente a `ObservableObject`, que invalidaba la vista ante cualquier `@Published`.'),
          q('La vista usa `@Environment(Router.self) private var router` y has olvidado `.environment(router)` en la preview. ¿Qué pasa?', [
            'SwiftUI crea un `Router()` por defecto',
            'La preview (o la app) se cae en tiempo de ejecución',
            'No compila',
            '`router` vale `nil` y los botones no hacen nada',
          ], 1, 'Con un tipo no opcional no hay valor por defecto: falla en tiempo de ejecución. Si el objeto puede faltar, decláralo como `Router?`.'),
        ],
      },

      // ─────────────────────────────────────────────────────────────────────
      {
        id: 'composicion',
        title: 'Composición de vistas e identidad',
        level: 'Intermedio',
        minutes: 12,
        tags: ['subvistas', '@ViewBuilder', 'AnyView', 'ViewModifier', 'ButtonStyle', 'identidad', 'ForEach'],
        summary: 'Vistas pequeñas como structs, estilos reutilizables y una identidad estable para que el estado, las tareas y las animaciones se comporten.',
        blocks: [
          p('Las vistas de SwiftUI son descripciones baratas (structs), no objetos pesados como un `UIView`. Trocéalas sin miedo: vistas pequeñas se leen mejor, se reutilizan, tienen su propia preview y además **rinden mejor**, porque cada subvista es una frontera donde SwiftUI decide si hace falta volver a evaluar.'),
          compare('swift', S`
            struct LibraryList: View {
                let books: [BookSummary]

                var body: some View {
                    List(books) { book in
                        row(book)
                    }
                }

                // ❌ Función que devuelve vista: se evalúa siempre
                // junto con el body del padre
                func row(_ book: BookSummary) -> some View {
                    HStack {
                        Text(book.title).font(.headline)
                        Spacer()
                        if book.isFavorite {
                            Image(systemName: "heart.fill")
                        }
                    }
                }
            }
          `, S`
            struct BookRow: View {
                let book: BookSummary

                var body: some View {
                    HStack {
                        VStack(alignment: .leading) {
                            Text(book.title).font(.headline)
                            Text(book.author)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if book.isFavorite {
                            Image(systemName: "heart.fill")
                                .foregroundStyle(.pink)
                                .accessibilityLabel("Favorito")
                        }
                    }
                }
            }
          `, {
            bad: 'Funciones y propiedades computadas que devuelven vistas se “inlinean” en el `body` del padre: no hay frontera de invalidación ni preview propia.',
            good: 'Una subvista `struct` con entradas mínimas: SwiftUI compara `book` y solo reevalúa su `body` si cambia. Reutilizable y previsualizable por separado.'
          }),
          h('@ViewBuilder en lugar de AnyView'),
          compare('swift', S`
            func content(for state: LibraryViewModel.State) -> AnyView {
                switch state {
                case .loading:
                    return AnyView(ProgressView())
                case .loaded(let books):
                    return AnyView(BookList(books: books))
                case .empty:
                    return AnyView(Text("Sin libros"))
                case .failed(let failure):
                    return AnyView(ErrorView(failure: failure))
                }
            }
          `, S`
            struct LibraryContent: View {
                let state: LibraryViewModel.State

                var body: some View {          // body ya es un @ViewBuilder
                    switch state {
                    case .loading:
                        ProgressView()
                    case .loaded(let books):
                        BookList(books: books)
                    case .empty:
                        ContentUnavailableView("Sin libros", systemImage: "books.vertical")
                    case .failed(let failure):
                        ErrorView(failure: failure)
                    }
                }
            }
          `, {
            bad: '`AnyView` borra el tipo: SwiftUI pierde la estructura para comparar ramas y animar transiciones, y paga un coste extra en cada actualización.',
            good: 'Con `switch` dentro de un `@ViewBuilder` el tipo resultante conserva cada rama. Para funciones auxiliares, márcalas con `@ViewBuilder` y devuelve `some View`.'
          }),
          h('Estilo reutilizable: ViewModifier y ButtonStyle'),
          p('Si copias la misma cadena de modificadores en tres sitios, es un componente. `ViewModifier` agrupa modificadores; `ButtonStyle` define cómo se ve un botón en todos sus estados (pulsado, deshabilitado) sin tocar su acción.'),
          code('swift', S`
            struct CardStyle: ViewModifier {
                func body(content: Content) -> some View {
                    content
                        .padding()
                        .background(.background.secondary, in: .rect(cornerRadius: 12))
                }
            }

            extension View {
                func cardStyle() -> some View { modifier(CardStyle()) }
            }

            struct PrimaryButtonStyle: ButtonStyle {
                func makeBody(configuration: Configuration) -> some View {
                    configuration.label
                        .font(.headline)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(.tint, in: .capsule)
                        .foregroundStyle(.white)
                        .opacity(configuration.isPressed ? 0.7 : 1)
                }
            }

            extension ButtonStyle where Self == PrimaryButtonStyle {
                static var primary: Self { .init() }
            }

            // Uso: Button("Reintentar") { ... }.buttonStyle(.primary)
          `),
          h('Identidad: estructural y explícita'),
          p('SwiftUI identifica cada vista por su **posición** en la jerarquía (identidad estructural) o por un **id** explícito (`ForEach`, `.id()`). La identidad decide la vida de la vista: mientras se mantiene, su `@State` sobrevive, su `.task` sigue viva y los cambios se animan. Si cambia, SwiftUI destruye la vista vieja y crea otra desde cero.'),
          compare('swift', S`
            extension View {
                // ❌ "Modificador condicional": dos ramas = dos vistas distintas
                @ViewBuilder
                func applyIf<V: View>(_ condition: Bool, _ transform: (Self) -> V) -> some View {
                    if condition { transform(self) } else { self }
                }
            }

            BookRow(book: book)
                .applyIf(book.isFavorite) { $0.background(.yellow.opacity(0.2)) }
          `, S`
            BookRow(book: book)
                // ✅ Misma vista; solo cambia el valor del modificador
                .background(book.isFavorite ? Color.yellow.opacity(0.2) : Color.clear)
          `, {
            bad: 'Cuando cambia la condición, SwiftUI ve otra vista: destruye y recrea la fila, pierde su `@State`, reinicia su `.task` y la transición no se anima bien.',
            good: 'Cambias el *valor* de un modificador, no la estructura. La identidad es estable y el cambio se anima.'
          }),
          h('ForEach con ids estables'),
          compare('swift', S`
            // ❌ Índices como identidad: al borrar o reordenar,
            // el estado "salta" de una fila a otra
            ForEach(books.indices, id: \.self) { index in
                BookRow(book: books[index])
            }

            // ❌ Un id nuevo cada vez que se crea el valor:
            // si mapeas en cada emisión, todo se recrea siempre
            struct BookItem: Identifiable {
                let id = UUID()
                let title: String
            }
          `, S`
            // ✅ Identidad del dominio: el id del libro que viene de KMP
            struct BookSummary: Identifiable, Hashable, Sendable {
                let id: String
                let title: String
                // ...
            }

            ForEach(books) { book in
                BookRow(book: book)
            }
          `),
          p('Y cuando quieras **resetear** el estado a propósito, cambia la identidad explícitamente con `.id(_:)`. Por ejemplo, un detalle que se reutiliza para otro libro:'),
          code('swift', S`
            BookDetailScreen(bookID: selectedID, service: service)
                .id(selectedID)   // libro distinto → estado nuevo y .task relanzada
          `),
          note('kmp', 'Ids del dominio, nunca identidad de objetos Kotlin', 'Las filas deben identificarse con el id del dominio (el `id` del `Book` de Kotlin, mapeado a `String` en tu struct Swift). Nunca uses `ObjectIdentifier` de un objeto Kotlin: cada emisión del Flow puede traer instancias nuevas del mismo libro y SwiftUI recrearía todas las filas.'),
          keys([
            'Extrae subvistas como `struct` con entradas mínimas: son fronteras de invalidación y tienen preview propia.',
            'Evita `AnyView`; usa `@ViewBuilder` (o el propio `body`) con `switch` o `if`.',
            'Comparte estilo con `ViewModifier` y `ButtonStyle`, no copiando modificadores.',
            'Identidad estable: ids del dominio en `ForEach`, nada de índices ni `UUID()` al vuelo; cambia valores de modificadores, no la estructura.',
            '`.id(x)` resetea el estado a propósito cuando cambia `x`.',
          ]),
        ],
        quiz: [
          q('¿Qué problema tiene `ForEach(books.indices, id: \\.self)` cuando el usuario borra un libro?', [
            'Ninguno, es la forma recomendada',
            'El estado de las filas (y sus tareas) queda asociado a la posición, no al libro',
            'No compila con arrays',
            'Solo afecta a las animaciones en macOS',
          ], 1, 'Con índices, la fila que ocupa una posición “hereda” el estado de otra al borrar o reordenar. Usa el `id` estable del dominio.'),
          q('Quieres resaltar una fila si es favorita. ¿Qué opción mantiene la identidad de la vista?', [
            '`.applyIf(book.isFavorite) { $0.background(.yellow) }`',
            '`if book.isFavorite { row.background(.yellow) } else { row }`',
            '`.background(book.isFavorite ? Color.yellow : Color.clear)`',
            'Envolver ambas ramas en `AnyView`',
          ], 2, 'Las dos primeras crean dos ramas (dos identidades) y `AnyView` oculta la estructura. Cambiar solo el valor del modificador mantiene la misma vista.'),
          q('¿Por qué preferir `struct BookRow: View` a `func row(_:) -> some View` dentro de la pantalla?', [
            'Porque las funciones no pueden devolver vistas',
            'Porque la subvista es una frontera de invalidación: SwiftUI solo reevalúa su `body` si cambian sus entradas',
            'Porque las structs se dibujan con Metal y las funciones no',
            'Da igual, es solo estilo',
          ], 1, 'La función se evalúa siempre con el padre. La struct tiene entradas comparables, ciclo de vida propio y preview independiente.'),
          q('¿Qué hace `.id(bookID)` aplicado a una pantalla de detalle?', [
            'Nada, es solo para los tests de UI',
            'Cuando cambia `bookID`, SwiftUI la trata como una vista nueva: estado reiniciado y `.task` relanzada',
            'Mejora la accesibilidad',
            'Evita que la vista se redibuje',
          ], 1, '`.id(_:)` cambia la identidad explícita. Para tests de UI se usa `accessibilityIdentifier`, que es otra cosa.'),
        ],
      },

      // ─────────────────────────────────────────────────────────────────────
      {
        id: 'ciclo-vida',
        title: 'Tareas y ciclo de vida: .task, .refreshable, .onChange',
        level: 'Intermedio',
        minutes: 11,
        tags: ['.task', '.task(id:)', '.refreshable', '.onChange', 'cancelación', 'scenePhase', 'debounce'],
        summary: 'Ata el trabajo asíncrono a la vida de la vista para que se cancele solo, y no hagas trabajo en init ni en body.',
        blocks: [
          p('Tú no controlas cuándo SwiftUI crea, reevalúa o destruye vistas: el `init` y el `body` de una vista pueden ejecutarse decenas de veces. Por eso el trabajo asíncrono (cargar datos, escuchar cambios) tiene que colgar del **ciclo de vida** de la vista, no de su `init`. La herramienta es `.task`.'),
          compare('swift', S`
            struct LibraryScreen: View {
                @State private var viewModel: LibraryViewModel

                var body: some View {
                    LibraryContent(state: viewModel.state)
                        .onAppear {
                            // ❌ Nadie cancela esta tarea al salir y
                            // onAppear puede ejecutarse varias veces
                            Task { await viewModel.observeBooks() }
                        }
                }
            }
          `, S`
            struct LibraryScreen: View {
                @State private var viewModel: LibraryViewModel

                var body: some View {
                    LibraryContent(state: viewModel.state)
                        // ✅ Empieza al aparecer y se cancela
                        // automáticamente al desaparecer
                        .task { await viewModel.observeBooks() }
                }
            }
          `, {
            bad: 'Un `Task {}` suelto no tiene dueño: sigue vivo al salir de la pantalla y cada `onAppear` (volver de un detalle, cambiar de pestaña) lanza otro.',
            good: '`.task` hereda el aislamiento de la vista (`@MainActor`) y SwiftUI cancela la tarea cuando la vista desaparece.'
          }),
          note('kmp', 'Flows de KMP dentro de .task', 'Si `observeBooks()` itera un Flow de KMP con `for await` (a través de SKIE y la capa adaptadora), cuando `.task` se cancela SKIE cancela también la corrutina de Kotlin: la recolección se detiene sola al salir de la pantalla. Con `Task {}` en `onAppear` el Flow seguiría vivo. Ojo: con el puente Obj-C “a pelo” la cancelación no se propaga (ver [suspend y Flow desde SwiftUI](#/l/suspend-flow)).'),
          h('Nada de trabajo en init ni en body'),
          list([
            '**`init` de la vista**: solo asigna propiedades. Puede ejecutarse cada vez que el padre se reevalúa y no hay forma de cancelar lo que lances ahí.',
            '**`body`**: debe ser puro y barato. Nada de llamadas de red, `print` con efectos, ordenar listas grandes ni crear formatters.',
            '**`init` del ViewModel**: solo guarda dependencias. La carga empieza cuando la vista llama a un método `async` desde `.task`.',
          ]),
          h('.task(id:) para reaccionar a cambios: búsqueda con debounce'),
          p('`.task(id:)` relanza la tarea cada vez que cambia el valor y **cancela la anterior**. Combinado con `Task.sleep`, te da un debounce sin Combine ni timers: si el usuario sigue escribiendo, la espera se cancela antes de llegar a la red.'),
          code('swift', S`
            struct LibraryScreen: View {
                @State private var viewModel: LibraryViewModel

                var body: some View {
                    LibraryContent(state: viewModel.state)
                        .searchable(text: $viewModel.query)
                        .task { await viewModel.observeBooks() }
                        .task(id: viewModel.query) { await viewModel.search() }
                }
            }

            // En LibraryViewModel (@MainActor @Observable)
            func search() async {
                let text = query   // la longitud mínima la valida el caso de uso de Kotlin
                guard !text.isEmpty else {
                    searchResults = nil
                    return
                }
                do {
                    try await Task.sleep(for: .milliseconds(300))   // debounce
                } catch {
                    return   // cancelada: el usuario siguió escribiendo
                }
                do throws(LibraryFailure) {
                    searchResults = try await service.search(text)
                } catch {
                    if error != .cancelled { failure = error }
                }
            }
          `),
          h('.refreshable y .onChange'),
          code('swift', S`
            List(books) { book in
                BookRow(book: book)
            }
            // El indicador de "tirar para refrescar" dura lo que dure el await
            .refreshable { await viewModel.refresh() }
            // Reacción síncrona a un cambio (iOS 17: recibe valor viejo y nuevo)
            .onChange(of: viewModel.query) { oldValue, newValue in
                if newValue.isEmpty { scrollToTop() }
            }
          `),
          p('`onChange(of:initial:_:)` es para reacciones **síncronas** (analítica, resetear el scroll, validar). Si la reacción es asíncrona, usa `.task(id:)`: lanzar un `Task {}` desde `onChange` vuelve a dejarte tareas sin cancelar.'),
          h('Volver a primer plano: scenePhase'),
          code('swift', S`
            struct LibraryScreen: View {
                @Environment(\.scenePhase) private var scenePhase
                @State private var viewModel: LibraryViewModel

                var body: some View {
                    LibraryContent(state: viewModel.state)
                        // Se ejecuta al aparecer y en cada cambio de fase
                        .task(id: scenePhase) {
                            if scenePhase == .active { await viewModel.refresh() }
                        }
                }
            }
          `),
          table(['Modificador', 'Úsalo para'], [
            ['`.task`', 'Trabajo asíncrono ligado a la vida de la vista (cargar, observar un Flow).'],
            ['`.task(id:)`', 'Relanzar trabajo cuando cambia un valor (búsqueda, filtro, id seleccionado).'],
            ['`.refreshable`', 'Tirar para refrescar; el indicador espera al `await`.'],
            ['`.onChange(of:)`', 'Reacciones síncronas a un cambio de valor.'],
            ['`.onAppear` / `.onDisappear`', 'Efectos síncronos ligeros (analítica). Nunca trabajo asíncrono.'],
          ]),
          keys([
            'Trabajo asíncrono de UI = `.task`, `.task(id:)` o `.refreshable`: se cancela solo.',
            'Nunca `Task {}` en `onAppear` ni en `onChange` para cargar o escuchar datos.',
            '`init` y `body` de las vistas: sin efectos. El ViewModel empieza a trabajar cuando la vista se lo pide.',
            '`.task(id:)` + `Task.sleep` es el debounce idiomático.',
            'Con SKIE, cancelar la tarea Swift cancela la corrutina Kotlin: los Flows se paran al salir de la pantalla.',
          ]),
        ],
        quiz: [
          q('¿Qué ventaja clave tiene `.task` frente a `onAppear { Task { ... } }`?', [
            'Se ejecuta en un hilo de fondo',
            'Se cancela automáticamente cuando la vista desaparece',
            'Se ejecuta una sola vez en toda la vida de la app',
            'Permite usar `await` dentro de `body`',
          ], 1, 'La cancelación automática es lo importante. Y no, no se ejecuta en segundo plano: hereda el aislamiento de la vista (`@MainActor`).'),
          q('Implementas un buscador con debounce. ¿Qué combinación es la idiomática en SwiftUI?', [
            '`.onChange(of: query)` + `DispatchQueue.main.asyncAfter`',
            '`.task(id: query)` + `try await Task.sleep(for:)` al principio',
            'Un `Timer` creado en el `init` de la vista',
            'Combine con `debounce` dentro de `body`',
          ], 1, 'Cada cambio de `query` cancela la tarea anterior; el `sleep` cancelado lanza `CancellationError` y la búsqueda nunca llega a la red.'),
          q('¿Dónde NO debes lanzar la carga inicial de datos?', [
            'En `.task`',
            'En el `init` de la vista',
            'En un método `async` del ViewModel llamado desde `.task`',
            'En `.refreshable`, si es la recarga manual',
          ], 1, 'El `init` de una vista puede ejecutarse muchas veces (cada vez que el padre se reevalúa) y no tiene ciclo de vida: lo que lances ahí no se puede cancelar.'),
          q('La vista recoge un Flow de KMP con `for await` dentro de `.task`, usando SKIE. El usuario sale de la pantalla. ¿Qué ocurre?', [
            'El Flow sigue emitiendo hasta que la app pasa a segundo plano',
            'SwiftUI cancela la tarea y SKIE cancela la corrutina de Kotlin',
            'La app se cae porque el Flow no ha terminado',
            'Hay que llamar a `close()` sobre el Flow en `onDisappear`',
          ], 1, 'SKIE propaga la cancelación en los dos sentidos. Por eso `.task` es el sitio natural para observar Flows.'),
        ],
      },

      // ─────────────────────────────────────────────────────────────────────
      {
        id: 'navegacion',
        title: 'Navegación tipada con NavigationStack',
        level: 'Intermedio',
        minutes: 11,
        tags: ['NavigationStack', 'navigationDestination', 'Router', 'sheet(item:)', 'deep links'],
        summary: 'La navegación como datos: un array de rutas Hashable que controlas, pruebas y restauras desde un deep link.',
        blocks: [
          p('Desde iOS 16, `NavigationStack` convierte la navegación en **datos**: la pila es un array de valores que tú controlas. Eso te da navegación programática (“vuelve a la raíz”), deep links y tests sin magia. `NavigationView` está obsoleto: no lo uses en código nuevo.'),
          compare('swift', S`
            struct LibraryScreen: View {
                let books: [BookSummary]
                let service: any LibraryService

                var body: some View {
                    NavigationView {                       // ❌ obsoleto
                        List(books) { book in
                            // ❌ Construye BookDetailScreen (y su ViewModel)
                            // para cada fila, aunque nunca navegues
                            NavigationLink(destination: BookDetailScreen(
                                bookID: book.id, service: service
                            )) {
                                BookRow(book: book)
                            }
                        }
                    }
                }
            }
          `, S`
            enum Route: Hashable {
                case book(id: String)
                case settings
            }

            struct BookListRows: View {
                let books: [BookSummary]

                var body: some View {
                    List(books) { book in
                        // ✅ Solo un valor: el destino se crea al navegar
                        NavigationLink(value: Route.book(id: book.id)) {
                            BookRow(book: book)
                        }
                    }
                }
            }
          `, {
            bad: '`NavigationLink(destination:)` evalúa el destino de forma ansiosa por cada fila que se pinta.',
            good: '`NavigationLink(value:)` solo añade un valor a la pila; quien lo convierte en vista es `navigationDestination(for:)`.'
          }),
          h('Un Router @Observable y la pila en un solo sitio'),
          code('swift', S`
            @MainActor
            @Observable
            final class Router {
                var path: [Route] = []

                func open(_ route: Route) { path.append(route) }
                func popToRoot() { path.removeAll() }
            }

            struct RootView: View {
                @State private var router = Router()
                let dependencies: AppDependencies

                var body: some View {
                    NavigationStack(path: $router.path) {
                        LibraryScreen(service: dependencies.library)
                            .navigationDestination(for: Route.self) { route in
                                switch route {
                                case .book(let id):
                                    BookDetailScreen(bookID: id, service: dependencies.library)
                                case .settings:
                                    SettingsScreen()
                                }
                            }
                    }
                    .environment(router)   // cualquier vista puede navegar
                }
            }
          `, 'Toda la navegación de la pila, en un switch'),
          p('El `switch` sobre `Route` es exhaustivo: si alguien añade una ruta nueva, el compilador te obliga a decir qué pantalla pinta. Y como el `Router` es una clase normal con un array, puedes testear la lógica de navegación sin UI (por ejemplo: “tras guardar, `path` vuelve a estar vacío”).'),
          h('Las rutas llevan ids, no objetos'),
          note('kmp', 'Nada de objetos Kotlin en las rutas', 'Una ruta debe ser `Hashable`, barata y estable: `case book(id: String)`. No metas en ella un `Book` de `Shared` (ni siquiera un `BookSummary` completo): la pantalla de destino carga lo que necesita con su ViewModel, el dato no se queda obsoleto y la misma ruta sirve para deep links y restauración de estado. Además, los objetos Kotlin no son `Sendable` y no deberían salir de la capa adaptadora.'),
          h('Hojas modales con .sheet(item:)'),
          compare('swift', S`
            @State private var isShowingEditor = false
            @State private var selectedBook: BookSummary?

            // ...
            .sheet(isPresented: $isShowingEditor) {
                // ❌ Dos fuentes de verdad: puede abrirse con selectedBook == nil
                if let selectedBook {
                    BookEditor(book: selectedBook)
                }
            }
          `, S`
            struct BookActions: View {
                let book: BookSummary
                @State private var editingBook: BookSummary?

                var body: some View {
                    Button("Editar") { editingBook = book }
                        .sheet(item: $editingBook) { book in
                            BookEditor(book: book)   // ✅ solo existe si hay libro
                        }
                }
            }
          `, {
            bad: 'Un `Bool` más un opcional se pueden desincronizar: hoja vacía o que no se cierra.',
            good: 'Un único opcional `Identifiable`: la hoja está abierta si y solo si hay valor. Al cerrarla, SwiftUI lo pone a `nil`.'
          }),
          h('Deep links: de URL a ruta'),
          code('swift', S`
            extension Route {
                /// biblioteca://book/123  →  .book(id: "123")
                init?(url: URL) {
                    guard url.scheme == "biblioteca", url.host() == "book" else { return nil }
                    let id = url.lastPathComponent
                    guard !id.isEmpty, id != "/" else { return nil }
                    self = .book(id: id)
                }
            }

            // En RootView
            NavigationStack(path: $router.path) { /* ... */ }
                .onOpenURL { url in
                    guard let route = Route(url: url) else { return }
                    router.path = [route]   // la navegación es un dato: asígnalo
                }
          `),
          keys([
            '`NavigationStack(path:)` + `enum Route: Hashable` + `navigationDestination(for:)`; nada de `NavigationView`.',
            '`NavigationLink(value:)` en vez de `NavigationLink(destination:)`: el destino se construye al navegar.',
            'Las rutas llevan ids, nunca objetos Kotlin ni ViewModels.',
            'Un `Router` `@Observable` en el entorno centraliza la pila y es testeable.',
            '`.sheet(item:)` con un opcional `Identifiable` en lugar de `Bool` + opcional.',
          ]),
        ],
        quiz: [
          q('¿Qué problema tiene `NavigationLink(destination: BookDetailScreen(...))` dentro de una lista larga?', [
            'Ninguno',
            'Construye el destino (y su ViewModel) por cada fila que se pinta, aunque nunca se navegue',
            'No permite volver atrás',
            'Solo funciona en iPad',
          ], 1, 'El destino se evalúa al construir la fila. Con `NavigationLink(value:)` + `navigationDestination(for:)` se crea solo al navegar.'),
          q('¿Qué debería contener un `case` de tu `enum Route`?', [
            'El `Book` de Kotlin, para no volver a cargarlo',
            'El ViewModel ya creado de la pantalla destino',
            'Un identificador estable, como `book(id: String)`',
            'Una closure que construya la vista',
          ], 2, 'Ids: `Hashable`, baratos, válidos para deep links y restauración. La pantalla destino carga sus datos.'),
          q('Quieres abrir un detalle desde una notificación push. ¿Cómo lo haces con `NavigationStack(path:)`?', [
            'Con un `NavigationLink` oculto y `isActive`',
            'Asignando `router.path = [.book(id: id)]`',
            'Presentando un `UIViewController` por encima',
            'No se puede con SwiftUI',
          ], 1, 'La pila es un array de rutas: navegar es asignar datos.'),
          q('Para una hoja que edita un libro concreto, ¿qué API usas?', [
            '`.sheet(isPresented:)` + un `@State` opcional aparte',
            '`.sheet(item:)` con un `@State` opcional `Identifiable`',
            '`.fullScreenCover` siempre',
            '`.popover` con un `Bool`',
          ], 1, 'Un solo dato controla la presentación y el contenido: sin estados imposibles.'),
        ],
      },

      // ─────────────────────────────────────────────────────────────────────
      {
        id: 'previews',
        title: 'Previews rápidas y sin KMP',
        level: 'Básico',
        minutes: 10,
        tags: ['#Preview', '@Previewable', 'PreviewModifier', 'fakes', 'datos de ejemplo'],
        summary: 'Previews de cada estado con fakes Swift: feedback inmediato sin arrancar el runtime de Kotlin.',
        blocks: [
          p('Las previews son tu bucle de feedback más rápido… mientras no arrastren media app. En un proyecto KMP, una preview que toca el framework `Shared` arranca el runtime de Kotlin, la inyección de dependencias, la base de datos y la red: lenta, frágil y dependiente de datos reales. La regla: **las previews dependen de protocolos Swift y fakes; KMP nunca arranca en una preview**.'),
          compare('swift', S`
            import Shared

            #Preview {
                // ❌ Arranca DI, base de datos y red de KMP
                // solo para ver una lista
                let container = LibraryContainer(tokenStorage: KeychainTokenStorage(),
                                                 baseUrl: "https://api.example.com")
                LibraryScreen(service: KMPLibraryService(container: container))
            }
          `, S`
            #Preview("Con libros") {
                NavigationStack {
                    // ✅ Datos fijos, sin red ni Kotlin
                    LibraryScreen(service: FakeLibraryService(items: BookSummary.samples))
                }
            }
          `),
          h('Una preview por estado'),
          p('Separa la pantalla que **posee** el ViewModel (`LibraryScreen`) de la vista que **pinta** un estado (`LibraryContent(state:)`). La segunda es una función pura del estado y previsualizar cada caso es trivial: cargando, vacío, error y contenido.'),
          code('swift', S`
            #Preview("Cargando") {
                LibraryContent(state: .loading)
            }

            #Preview("Vacío") {
                LibraryContent(state: .empty)
            }

            #Preview("Sin conexión") {
                LibraryContent(state: .failed(.offline))
            }

            #Preview("Con libros") {
                LibraryContent(state: .loaded(BookSummary.samples))
            }
          `),
          h('Datos de ejemplo y fakes'),
          code('swift', S`
            extension BookSummary {
                static let samples: [BookSummary] = [
                    BookSummary(id: "1", title: "Cien años de soledad", author: "Gabriel García Márquez",
                                year: 1967, coverURL: nil, isFavorite: true),
                    BookSummary(id: "2", title: "La sombra del viento", author: "Carlos Ruiz Zafón",
                                year: 2001, coverURL: nil, isFavorite: false),
                ]
            }

            /// Fake para previews: datos fijos, sin red ni KMP (versión simplificada).
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
                // book(id:), setFavorite(_:for:) y search(_:) siguen el mismo patrón
            }
          `),
          p('En el [proyecto guiado](#/l/p4-vistas) verás el fake completo, que además sirve para los tests.'),
          h('@Previewable: estado dentro de la preview'),
          code('swift', S`
            #Preview("Favorito interactivo") {
                @Previewable @State var isFavorite = false
                FavoriteToggle(isOn: $isFavorite)
            }
          `),
          h('Entorno compartido con PreviewModifier (iOS 18+)'),
          p('Si veinte previews necesitan el mismo entorno (un `Router`, un tema, datos caros de preparar), no lo repitas: un `PreviewModifier` crea un contexto compartido una vez y lo aplicas como *trait*.'),
          code('swift', S`
            struct AppPreviewEnvironment: PreviewModifier {
                // Se crea una vez y se reutiliza entre previews
                static func makeSharedContext() async throws -> Router {
                    await Router()
                }

                func body(content: Content, context: Router) -> some View {
                    content.environment(context)
                }
            }

            extension PreviewTrait where T == Preview.ViewTraits {
                @MainActor static var appEnvironment: Self = .modifier(AppPreviewEnvironment())
            }

            #Preview("Fila", traits: .appEnvironment) {
                BookRow(book: BookSummary.samples[0])
            }
          `),
          h('Variantes: tamaño de letra, modo oscuro, idioma'),
          code('swift', S`
            #Preview("Texto XXL", traits: .sizeThatFitsLayout) {
                BookRow(book: BookSummary.samples[0])
                    .environment(\.dynamicTypeSize, .accessibility3)
            }

            #Preview("Oscuro y en inglés") {
                LibraryContent(state: .loaded(BookSummary.samples))
                    .preferredColorScheme(.dark)
                    .environment(\.locale, Locale(identifier: "en"))
            }
          `),
          note('new', 'Xcode 27', 'Las Live Previews de Xcode 27 añaden tiradores para redimensionar el lienzo: útiles para comprobar layouts adaptativos sin cambiar de dispositivo.'),
          note('kmp', 'Si la preview necesita import Shared, es una pista de diseño', 'Una vista cuya preview necesita `import Shared` está tocando tipos Kotlin. Mueve el mapeo a la [capa adaptadora](#/l/capa-adaptadora) y deja que la vista reciba structs Swift. Si además tus vistas viven en un paquete Swift de feature que no depende de `Shared`, sus previews ni siquiera tienen que compilar ni enlazar el framework de KMP.'),
          keys([
            'Las previews usan fakes de protocolos Swift: KMP nunca arranca en una preview.',
            'Separa la pantalla (dueña del ViewModel) del contenido (función pura del estado) y previsualiza cada estado.',
            'Datos de ejemplo como `static let samples` junto al modelo o en un módulo de soporte.',
            '`@Previewable` para estado local; `PreviewModifier` (iOS 18+) para entorno compartido.',
            'Previsualiza Dynamic Type grande, modo oscuro y otro idioma desde el primer día.',
          ]),
        ],
        quiz: [
          q('¿Por qué tus previews no deberían usar `KMPLibraryService`?', [
            'Porque KMP no funciona en el simulador',
            'Porque arrancan el runtime de Kotlin, DI, base de datos y red: previews lentas, frágiles y con datos reales',
            'Porque las previews no admiten código `async`',
            'Porque Apple lo prohíbe en App Store',
          ], 1, 'KMP funciona perfectamente en el simulador; el problema es el coste y la fragilidad. Un fake con datos fijos da previews instantáneas y deterministas.'),
          q('¿Qué ganas separando `LibraryScreen` (dueña del ViewModel) de `LibraryContent(state:)`?', [
            'Nada, es duplicar código',
            'Puedes previsualizar cada estado (cargando, vacío, error, datos) pasando un valor, sin ViewModel',
            'Mejor rendimiento en release',
            'Evitar usar `@State`',
          ], 1, 'Una vista que es función pura de un estado se previsualiza (y se razona) mucho mejor.'),
          q('¿Para qué sirve `@Previewable`?', [
            'Para marcar vistas que solo existen en DEBUG',
            'Para declarar `@State` (u otros property wrappers dinámicos) directamente dentro de `#Preview`',
            'Para que la preview use datos de producción',
            'Para generar capturas de pantalla automáticas',
          ], 1, 'Evita crear una vista contenedora solo para tener estado en la preview.'),
          q('Tienes que inyectar el `Router` en el entorno de veinte previews. ¿Qué herramienta de iOS 18 evita repetirlo?', [
            '`PreviewProvider`',
            'Un `PreviewModifier` expuesto como *trait*',
            'Un singleton global',
            '`UserDefaults`',
          ], 1, 'El `PreviewModifier` crea el contexto compartido una vez y se aplica con `#Preview(traits: .appEnvironment)`.'),
        ],
      },

      // ─────────────────────────────────────────────────────────────────────
      {
        id: 'calidad-ui',
        title: 'Rendimiento, accesibilidad y localización',
        level: 'Intermedio',
        minutes: 13,
        tags: ['rendimiento', 'Dynamic Type', 'VoiceOver', 'String Catalog', 'FormatStyle', 'Instruments'],
        summary: 'Tres cualidades baratas si las cuidas desde el principio y carísimas si las dejas para el final.',
        blocks: [
          p('Rendimiento, accesibilidad y localización no son una fase final: son hábitos. Cuestan poco si los aplicas al escribir cada vista y mucho si llegan como “ticket de deuda” a dos semanas de publicar.'),
          h('Rendimiento: body barato'),
          compare('swift', S`
            struct BookList: View {
                let books: [BookSummary]
                let lastSync: Date

                var body: some View {
                    // ❌ Ordena en cada evaluación de body
                    let sorted = books.sorted { $0.title < $1.title }

                    // ❌ Crea un DateFormatter (caro) en cada render
                    let formatter = DateFormatter()
                    formatter.dateStyle = .medium

                    return List(sorted) { book in
                        BookRow(book: book)
                    }
                    .safeAreaInset(edge: .bottom) {
                        Text("Sincronizado: " + formatter.string(from: lastSync))
                    }
                }
            }
          `, S`
            struct BookList: View {
                let books: [BookSummary]   // ya ordenados por el ViewModel
                let lastSync: Date

                var body: some View {
                    List(books) { book in
                        BookRow(book: book)
                    }
                    .safeAreaInset(edge: .bottom) {
                        // ✅ Formato localizado, sin crear formatters
                        Text("Sincronizado: \(lastSync, format: .dateTime.day().month().hour().minute())")
                    }
                }
            }
          `, {
            bad: '`body` se evalúa muchas veces: ordenar y crear formatters ahí se paga en cada render. Y concatenar strings rompe la localización.',
            good: 'Datos listos para pintar desde el ViewModel y `FormatStyle` en la interpolación: el texto entra en el String Catalog con su marcador.'
          }),
          list([
            'Colecciones largas: `List` o `LazyVStack`/`LazyVGrid`, que solo construyen lo visible.',
            'Pasa a cada subvista solo lo que necesita: con Observation, menos lecturas = menos redibujados.',
            'Mide antes de optimizar: la plantilla de SwiftUI en Instruments te dice qué vistas se actualizan y cuánto cuestan.',
          ]),
          code('swift', S`
            var body: some View {
                #if DEBUG
                let _ = Self._printChanges()   // imprime qué cambió y provocó el render
                #endif
                List(books) { BookRow(book: $0) }
            }
          `, 'Depurar redibujados'),
          h('Accesibilidad desde el primer día'),
          compare('swift', S`
            HStack {
                Text(book.title)
                    .font(.system(size: 17))                // ❌ ignora Dynamic Type
                Spacer()
                Image(systemName: book.isFavorite ? "heart.fill" : "heart")
                    .frame(width: 24, height: 24)           // ❌ tamaño fijo
                    .onTapGesture { onToggleFavorite() }    // ❌ VoiceOver no ve un botón
            }
          `, S`
            struct FavoriteBookRow: View {
                let book: BookSummary
                let onToggleFavorite: () -> Void
                @ScaledMetric(relativeTo: .body) private var iconSize = 24.0

                var body: some View {
                    HStack {
                        Text(book.title)
                            .font(.body)                          // ✅ escala con Dynamic Type
                        Spacer()
                        Button(action: onToggleFavorite) {
                            Image(systemName: book.isFavorite ? "heart.fill" : "heart")
                                .frame(width: iconSize, height: iconSize)
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel(book.isFavorite ? "Quitar de favoritos" : "Añadir a favoritos")
                    }
                }
            }
          `, {
            bad: 'Tamaños fijos que no escalan y un gesto que las tecnologías de asistencia no anuncian como acción.',
            good: 'Estilos de texto, `@ScaledMetric` para medidas, `Button` (que ya es accesible, enfocable y con traits correctos) y una etiqueta que describe la acción.'
          }),
          code('swift', S`
            VStack(alignment: .leading) {
                Text(book.title).font(.headline)
                Text(book.author).font(.subheadline)
                Text(book.year, format: .number.grouping(.never))   // un año no lleva separador de miles
            }
            .accessibilityElement(children: .combine)   // VoiceOver lo lee como un único elemento
          `, 'Agrupar elementos relacionados'),
          p('Completa con `accessibilityValue` (estado, p. ej. “favorito”), `accessibilityHint` cuando la acción no es obvia y `accessibilityAddTraits(.isHeader)` en los títulos de sección. Y pruébalo de verdad: VoiceOver activado, el Accessibility Inspector y una preview con `.accessibility3`.'),
          h('Localización con String Catalogs'),
          code('swift', S`
            // Los literales de Text son LocalizedStringKey: Xcode los extrae
            // al String Catalog (Localizable.xcstrings) al compilar
            Text("Biblioteca")

            // Plurales: en el catálogo, "Vary by Plural" para la clave "%lld libros"
            Text("\(books.count) libros")

            // Fuera de las vistas (ViewModel, notificaciones...)
            let message = String(localized: "Sin conexión. Revisa tu red.")

            // Números, fechas y medidas: FormatStyle según el locale del usuario
            Text(lastSync, format: .relative(presentation: .named))
          `),
          p('Nunca construyas frases concatenando trozos (`"Hay " + n + " libros"`): el orden de las palabras cambia entre idiomas y los plurales no siguen la regla “añade una s”. Una clave completa con marcadores y plurales en el catálogo resuelve las dos cosas.'),
          note('kmp', 'Los textos de usuario viven en Swift', 'El dominio KMP devuelve **datos** (`LibraryError.Offline`, un `Int`, un instante), no frases. Traducir y formatear es presentación: hazlo en Swift con String Catalogs y `FormatStyle`, que respetan idioma, región, plurales y accesibilidad de iOS. Si el módulo compartido devuelve “No hay conexión” ya redactado, no podrás localizarlo bien ni adaptar el tono a la plataforma. Si el equipo decide compartir textos (por ejemplo con recursos de Compose Multiplatform), que sea una decisión explícita y documentada.'),
          keys([
            '`body` recibe datos listos para pintar: nada de ordenar, filtrar ni crear formatters ahí.',
            'Mide con `Self._printChanges()` e Instruments antes de optimizar a ciegas.',
            'Estilos de texto y `@ScaledMetric`; acciones siempre con `Button` y etiqueta si solo hay icono.',
            'Todo texto visible en el String Catalog, con plurales; números y fechas con `FormatStyle`.',
            'KMP entrega datos; Swift decide cómo se dicen y se formatean.',
          ]),
        ],
        quiz: [
          q('¿Qué está mal en crear un `DateFormatter` dentro de `body`?', [
            'Nada, los formatters son baratos',
            '`body` se evalúa muchas veces y crear formatters (u ordenar listas) ahí se paga en cada render',
            'No compila en Swift 6',
            'Los formatters solo funcionan dentro del ViewModel',
          ], 1, 'Usa `FormatStyle` (`.formatted()`, `Text(_:format:)`), que el sistema optimiza, y prepara los datos fuera de `body`.'),
          q('Un icono de favorito usa `.onTapGesture`. ¿Cuál es el problema principal?', [
            'Ninguno',
            'VoiceOver y otras tecnologías de asistencia no lo tratan como un botón',
            'Consume más batería',
            'No funciona en iPad',
          ], 1, '`Button` es accesible por defecto (rasgo de botón, foco, acción). Añade `accessibilityLabel` si solo tiene icono.'),
          q('El módulo KMP devuelve el error `LibraryError.Offline`. ¿Dónde se convierte en el texto «Sin conexión»?', [
            'En Kotlin, dentro del caso de uso',
            'En Swift (ViewModel o vista), con una clave del String Catalog',
            'En el servidor',
            'En el `Info.plist`',
          ], 1, 'El dominio entrega datos; la presentación decide el texto según idioma y plataforma.'),
          q('¿Cómo pluralizas «1 libro / 3 libros» correctamente?', [
            'Con `if count == 1 { "libro" } else { "libros" }` en la vista',
            'Con `Text("\\(count) libros")` y «Vary by Plural» en el String Catalog',
            'Añadiendo una «s» con `+`',
            'Con una función en Kotlin que devuelva el texto',
          ], 1, 'Las reglas de plural cambian entre idiomas (ruso, árabe, polaco…). El String Catalog las gestiona por idioma; el `if` solo sirve para algunos.'),
        ],
      },
    ],
  });
})();
