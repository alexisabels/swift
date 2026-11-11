(function () {
  'use strict';
  const { p, h, code, compare, tabs, note, list, table, keys, q, S } = Curso.dsl;

  Curso.module({
    id: 'testing',
    order: 5,
    title: 'Testing',
    short: 'Testing',
    icon: 'flask',
    description: 'Tests rápidos y fiables con Swift Testing, y cómo probar ViewModels que dependen de KMP sin tocar el módulo compartido.',
    lessons: [
      // ---------------------------------------------------------------------
      {
        id: 'swift-testing',
        title: 'Swift Testing en la práctica',
        level: 'Básico',
        minutes: 12,
        tags: ['Swift Testing', '@Test', '#expect', '#require', 'parametrizados', 'confirmation', 'traits'],
        summary: 'El framework de tests moderno de Swift: macros expresivas, tests parametrizados y ejecución en paralelo.',
        blocks: [
          p('Swift Testing (Xcode 16+) es el framework de tests moderno de Swift: macros expresivas, tests parametrizados, ejecución en paralelo por defecto y soporte nativo de `async`. Para código nuevo, úsalo en lugar de XCTest. Ambos conviven en el mismo target, y en Xcode 27 la interoperabilidad entre ellos viene activada por defecto, así que puedes migrar fichero a fichero.'),
          h('Lo básico: `@Test` y `#expect`'),
          code('swift', S`
            import Testing
            @testable import Library

            struct BookFormatterTests {
                @Test("El año no lleva separador de miles")
                func yearWithoutGrouping() {
                    let book = BookSummary(id: "1", title: "La mano izquierda de la oscuridad",
                                           author: "Ursula K. Le Guin", year: 1969,
                                           coverURL: nil, isFavorite: false)
                    #expect(BookFormatter.subtitle(for: book) == "Ursula K. Le Guin · 1969")
                }
            }
          `),
          p('`#expect` acepta cualquier expresión booleana y, si falla, muestra el valor de cada lado: no necesitas `XCTAssertEqual`, `XCTAssertTrue` y compañía. Los tests son funciones normales que pueden ser `async` y `throws`, y viven en structs. Los nombres entre comillas aparecen en el navegador de tests: escríbelos en el idioma del equipo.'),
          compare('swift', S`
            import XCTest
            @testable import Library

            final class BookFormatterTests: XCTestCase {
                func testSubtitle() throws {
                    let book = try XCTUnwrap(BookSummary.samples.first)
                    XCTAssertEqual(BookFormatter.subtitle(for: book), "Ursula K. Le Guin · 1969")
                    XCTAssertFalse(book.isFavorite)
                }
            }
          `, S`
            import Testing
            @testable import Library

            struct BookFormatterTests {
                @Test func subtitle() throws {
                    let book = try #require(BookSummary.samples.first)
                    #expect(BookFormatter.subtitle(for: book) == "Ursula K. Le Guin · 1969")
                    #expect(!book.isFavorite)
                }
            }
          `, {
            badTitle: 'XCTest (sigue funcionando)',
            goodTitle: 'Swift Testing (para código nuevo)',
            bad: 'Una función de aserción para cada caso, clases que heredan de `XCTestCase` y mensajes de fallo pobres.',
            good: 'Una macro para todo, `#require` para las precondiciones y, si algo falla, verás el valor de cada lado de la expresión.'
          }),
          h('`#require`: precondiciones que detienen el test'),
          p('`try #require(…)` desenvuelve un opcional o comprueba una condición y, si falla, **detiene ese test** lanzando un error. Úsalo para lo que debe ser cierto para que el resto tenga sentido; usa `#expect` para lo que estás verificando. Para comprobar errores: `#expect(throws: LibraryFailure.self) { try … }`.'),
          h('Tests parametrizados'),
          code('swift', S`
            @Test("Traduce el código HTTP a un fallo de dominio", arguments: [
                (404, LibraryFailure.notFound),
                (500, LibraryFailure.server(code: 500)),
                (503, LibraryFailure.server(code: 503)),
            ])
            func mapsHTTPStatus(status: Int, expected: LibraryFailure) {
                #expect(LibraryFailure(httpStatus: status) == expected)
            }
          `),
          p('Cada tupla es un caso independiente: se ejecutan en paralelo y aparecen por separado en el navegador de tests, así que puedes relanzar solo el que falla. Si pasas **dos colecciones** (`arguments: a, b`) se prueban todas las combinaciones; para emparejarlas una a una, usa `zip(a, b)`.'),
          note('kmp', 'Los argumentos deben ser `Sendable`', 'Los argumentos de un test parametrizado tienen que ser `Sendable`, y los objetos de Kotlin no lo son. Parametriza con valores Swift (códigos, textos, enums) y construye los objetos Kotlin **dentro** del test, por ejemplo `LibraryErrorServer(code: Int32(status))`.'),
          h('Eventos: `confirmation`'),
          code('swift', S`
            @Test func publishesOneEventPerSave() async {
                await confirmation("Se publica el evento de guardado", expectedCount: 2) { saved in
                    let store = DraftStore(onSave: { saved() })
                    await store.save("Primer borrador")
                    await store.save("Segundo borrador")
                }
            }
          `),
          p('`confirmation` sustituye a `XCTestExpectation`, pero **no espera**: el evento debe ocurrir antes de que termine el closure. Si el código lanza trabajo en segundo plano y vuelve sin esperarlo, rediseña para poder hacer `await` de ese trabajo.'),
          h('Organizar: suites, etiquetas y traits'),
          code('swift', S`
            extension Tag {
                @Tag static var mapping: Self
                @Tag static var slow: Self
            }

            @Suite("Adaptador KMP", .tags(.mapping))
            struct KMPMappingTests {
                @Test func mapsBook() { /* … */ }

                @Test(.tags(.slow), .timeLimit(.minutes(1)))
                func mapsLargeCatalog() async { /* … */ }

                @Test(.disabled("Pendiente del endpoint v2"))
                func mapsReviews() { /* … */ }
            }
          `),
          list([
            'Los tests se ejecutan **en paralelo** por defecto y cada test recibe una instancia nueva de la suite: no compartas estado mutable entre tests.',
            '`@Suite(.serialized)` desactiva el paralelismo dentro de una suite. Úsalo solo si los tests comparten un recurso que no lo admite; casi siempre es mejor aislar el recurso.',
            '`withKnownIssue("motivo") { … }` marca un fallo conocido: no rompe la ejecución, pero te avisa cuando el problema deja de reproducirse.',
            'Filtra por etiquetas en el plan de tests para separar los tests lentos de los que lanzas en cada cambio.'
          ]),
          keys([
            '`#expect` verifica y continúa; `try #require` detiene el test si falla.',
            'Los tests parametrizados dan un caso por argumento; dos colecciones sueltas generan todas las combinaciones.',
            'Los argumentos deben ser `Sendable`: parametriza con valores Swift, no con objetos Kotlin.',
            '`confirmation` no espera: el evento debe ocurrir dentro del closure.',
            'Paralelo por defecto: nada de estado compartido entre tests.'
          ]),
        ],
        quiz: [
          q('¿Qué diferencia hay entre `#expect` y `#require`?',
            ['`#require` solo funciona en tests `async`', 'Son equivalentes', '`#expect` registra el fallo y continúa; `try #require` detiene el test si falla', '`#expect` detiene el test y `#require` continúa'],
            2, '`#require` lanza un error cuando falla, así que el resto del test no se ejecuta. Úsalo para precondiciones.'),
          q('Escribes `@Test(arguments: [1, 2, 3], ["a", "b"])` sobre una función de dos parámetros. ¿Cuántos casos se ejecutan?',
            ['6: todas las combinaciones', '3', '2', '5'],
            0, 'Dos colecciones separadas se combinan con producto cartesiano. Para emparejarlas una a una, usa `zip`.'),
          q('Quieres parametrizar un test con varios `LibraryError` de Kotlin. ¿Qué haces?',
            ['Pasar los objetos Kotlin en `arguments:`', 'Marcar el test con `@MainActor`', 'Usar XCTest, que no tiene esta limitación', 'Parametrizar con valores Swift y construir los objetos Kotlin dentro del test'],
            3, 'Los argumentos deben ser `Sendable` y los tipos de Kotlin no lo son. Construirlos dentro del test evita el problema.'),
          q('¿Qué hace `@Suite(.serialized)`?',
            ['Guarda los resultados en disco', 'Ejecuta sus tests uno detrás de otro en lugar de en paralelo', 'Hace que la suite sea `Sendable`', 'Ejecuta la suite en el actor principal'],
            1, 'Desactiva el paralelismo dentro de la suite. Es un parche para recursos compartidos: mejor aislarlos.'),
        ],
      },

      // ---------------------------------------------------------------------
      {
        id: 'testear-viewmodels',
        title: 'Testear ViewModels que dependen de KMP',
        level: 'Intermedio',
        minutes: 15,
        tags: ['ViewModel', 'fakes', 'spies', 'AsyncStream', 'debounce', 'mapeo de errores', 'commonTest'],
        summary: 'Qué probar en Swift y qué en KMP, fakes y spies seguros, streams deterministas y el mapeo de errores con tipos Kotlin reales.',
        blocks: [
          p('Con la lógica de negocio en KMP, los tests de Swift tienen un foco claro: **la presentación**. Qué estado ve el usuario, cómo se traducen los errores y qué pasa cuando algo falla. Para que sean rápidos y deterministas, el ViewModel no toca KMP: depende de un protocolo Swift que en los tests implementa un fake.'),
          h('¿Qué se prueba dónde?'),
          table(['Qué', 'Dónde', 'Por qué'], [
            ['Reglas de negocio, casos de uso, repositorios, mapeo DTO → dominio', 'KMP, en `commonTest`', 'Se escriben una vez y protegen Android e iOS a la vez.'],
            ['Estados de pantalla, transiciones, mensajes, *debounce*, actualizaciones optimistas', 'Swift Testing, sobre el ViewModel', 'Es lógica de presentación propia de iOS.'],
            ['Traducción de modelos y errores Kotlin → Swift', 'Swift Testing, sobre el adaptador, con tipos Kotlin reales', 'Es la frontera donde se rompen las cosas al actualizar el módulo compartido.'],
            ['Que la pantalla se ve bien en cada estado', 'Previews con fakes (y snapshots si compensa)', 'Revisión visual rápida de todos los estados.'],
          ]),
          h('El ViewModel bajo prueba'),
          code('swift', S`
            struct Profile: Equatable, Sendable {
                let name: String
                let email: String
                var newsletter: Bool
            }

            enum ProfileFailure: Error, Equatable {
                case offline, unauthorized, unknown(String), cancelled
            }

            protocol ProfileService: Sendable {
                func profileUpdates() -> AsyncStream<Profile>
                func setNewsletter(_ enabled: Bool) async throws(ProfileFailure)
                func searchContacts(_ text: String) async throws(ProfileFailure) -> [String]
            }
          `, 'El contrato: tipos Swift, nada de Kotlin'),
          code('swift', S`
            @MainActor
            @Observable
            final class ProfileViewModel {
                enum State: Equatable { case loading, loaded(Profile) }

                private(set) var state: State = .loading
                private(set) var lastError: ProfileFailure?
                private let service: any ProfileService

                init(service: any ProfileService) {
                    self.service = service
                }

                func observeProfile() async {
                    for await profile in service.profileUpdates() {
                        state = .loaded(profile)
                    }
                }

                func toggleNewsletter() async {
                    guard case .loaded(let current) = state else { return }
                    var updated = current
                    updated.newsletter.toggle()
                    state = .loaded(updated)                 // actualización optimista
                    do throws(ProfileFailure) {
                        try await service.setNewsletter(updated.newsletter)
                    } catch {
                        state = .loaded(current)             // deshacer
                        if error != .cancelled { lastError = error }
                    }
                }
            }
          `),
          h('Fakes y spies seguros'),
          p('Un **fake** es una implementación sencilla que funciona en memoria. Un **spy** además registra cómo lo han llamado. Como el protocolo es `Sendable`, el registro de llamadas debe ser seguro entre tareas: un `actor` es la forma más simple, sin locks ni `@unchecked`.'),
          code('swift', S`
            actor CallLog<Call: Sendable> {
                private(set) var calls: [Call] = []
                func record(_ call: Call) { calls.append(call) }
            }

            final class FakeProfileService: ProfileService {
                let emissions: [Profile]
                let newsletterFailure: ProfileFailure?
                let contacts: [String]
                let newsletterCalls = CallLog<Bool>()

                init(emissions: [Profile] = [], newsletterFailure: ProfileFailure? = nil,
                     contacts: [String] = []) {
                    self.emissions = emissions
                    self.newsletterFailure = newsletterFailure
                    self.contacts = contacts
                }

                func profileUpdates() -> AsyncStream<Profile> {
                    AsyncStream { continuation in
                        for profile in emissions { continuation.yield(profile) }
                        continuation.finish()              // clave: el stream termina
                    }
                }

                func setNewsletter(_ enabled: Bool) async throws(ProfileFailure) {
                    await newsletterCalls.record(enabled)
                    if let newsletterFailure { throw newsletterFailure }
                }

                func searchContacts(_ text: String) async throws(ProfileFailure) -> [String] {
                    contacts.filter { $0.localizedCaseInsensitiveContains(text) }
                }
            }
          `, 'Un fake Sendable por construcción: solo propiedades let'),
          h('Streams deterministas: que el `for await` termine'),
          p('El truco para testear `observeProfile()` sin esperas: el fake **termina** el stream después de emitir. Así, `await viewModel.observeProfile()` vuelve cuando el ViewModel ha procesado todos los valores y puedes comprobar el estado justo después. Sin `sleep`, sin tests intermitentes.'),
          code('swift', S`
            import Testing
            @testable import App

            extension Profile {
                static let ana = Profile(name: "Ana", email: "ana@example.com", newsletter: false)
            }

            @MainActor
            struct ProfileViewModelTests {
                @Test func showsTheLastEmittedProfile() async {
                    var subscribed = Profile.ana
                    subscribed.newsletter = true
                    let viewModel = ProfileViewModel(service: FakeProfileService(emissions: [.ana, subscribed]))

                    await viewModel.observeProfile()       // vuelve porque el stream termina

                    #expect(viewModel.state == .loaded(subscribed))
                }

                @Test func revertsTheToggleWhenSavingFails() async {
                    let service = FakeProfileService(emissions: [.ana], newsletterFailure: .offline)
                    let viewModel = ProfileViewModel(service: service)
                    await viewModel.observeProfile()

                    await viewModel.toggleNewsletter()

                    #expect(viewModel.state == .loaded(.ana))
                    #expect(viewModel.lastError == .offline)
                    #expect(await service.newsletterCalls.calls == [true])
                }
            }
          `),
          h('*Debounce* testeable: inyecta la duración'),
          code('swift', S`
            @MainActor
            @Observable
            final class ContactSearchViewModel {
                var query = ""
                private(set) var results: [String] = []
                private let service: any ProfileService
                private let debounce: Duration

                init(service: any ProfileService, debounce: Duration = .milliseconds(300)) {
                    self.service = service
                    self.debounce = debounce
                }

                // La vista la llama con .task(id: query): cada pulsación cancela la anterior
                func search() async {
                    do { try await Task.sleep(for: debounce) } catch { return }
                    do throws(ProfileFailure) {
                        results = try await service.searchContacts(query)
                    } catch {
                        results = []
                    }
                }
            }

            @MainActor
            @Test func searchesWithTheCurrentQuery() async {
                let fake = FakeProfileService(contacts: ["Ana", "Luis"])
                let viewModel = ContactSearchViewModel(service: fake, debounce: .zero)
                viewModel.query = "an"

                await viewModel.search()

                #expect(viewModel.results == ["Ana"])
            }
          `, 'En producción 300 ms; en el test, cero'),
          h('El mapeo de errores, con tipos Kotlin reales'),
          tabs([
            ['Kotlin (shared)', 'kotlin', S`
              sealed interface ProfileError {
                  data object Offline : ProfileError
                  data object Unauthorized : ProfileError
                  data class Unknown(val message: String) : ProfileError
              }

              class ProfileException(val error: ProfileError) : Exception()
            `],
            ['Swift · adaptador', 'swift', S`
              import Shared

              extension ProfileFailure {
                  init(_ error: any ProfileError) {
                      switch onEnum(of: error) {        // SKIE: switch exhaustivo
                      case .offline: self = .offline
                      case .unauthorized: self = .unauthorized
                      case .unknown(let unknown): self = .unknown(unknown.message)
                      }
                  }
              }
            `],
            ['Swift · test', 'swift', S`
              import Testing
              import Shared          // solo los tests del adaptador importan KMP
              @testable import App

              struct ProfileFailureMappingTests {
                  @Test func mapsUnauthorized() {
                      #expect(ProfileFailure(ProfileErrorUnauthorized.shared) == .unauthorized)
                  }

                  @Test("Conserva el mensaje de los errores desconocidos",
                        arguments: ["timeout", "HTTP 418"])
                  func keepsUnknownMessage(message: String) {
                      // El objeto Kotlin se crea dentro: los argumentos deben ser Sendable
                      let failure = ProfileFailure(ProfileErrorUnknown(message: message))
                      #expect(failure == .unknown(message))
                  }
              }
            `],
          ], 'Kotlin, adaptador y test'),
          note('kmp', 'Si un test de ViewModel necesita `import Shared`, algo se ha escapado', 'Los tests de ViewModel no deberían importar el framework KMP: usan fakes del protocolo Swift. Solo los tests del adaptador construyen tipos Kotlin reales (y el framework se enlaza en el target de tests para ellos). Si un test de ViewModel necesita Kotlin, es señal de que un tipo de KMP se ha colado más allá de la [capa adaptadora](#/l/capa-adaptadora). El proyecto guiado aplica todo esto en [Tests y revisión final](#/l/p5-tests).'),
          keys([
            'Reglas de negocio en `commonTest`; estados, transiciones y mapeos en Swift.',
            'Fakes con propiedades `let` y spies con un `actor`: `Sendable` sin trucos.',
            'Haz que los streams del fake terminen: `await viewModel.observe…()` vuelve y el test es determinista.',
            'Inyecta las duraciones (*debounce*, reintentos) y usa `.zero` en los tests.',
            'Prueba el mapeo de errores con tipos Kotlin reales, construidos dentro del test.'
          ]),
        ],
        quiz: [
          q('¿Dónde testeas la regla «un libro retirado del catálogo no se puede marcar como favorito»?',
            ['En `commonTest` del módulo KMP', 'En los tests del ViewModel de Swift', 'En una preview', 'En un test de UI'],
            0, 'Es una regla de negocio: vive en el dominio compartido y se prueba una vez para Android e iOS.'),
          q('¿Cómo consigues que `await viewModel.observeProfile()` termine dentro de un test?',
            ['Añadiendo un `Task.sleep` de un segundo', 'Cancelando la tarea desde otro hilo', 'Haciendo que el fake termine el stream con `finish()` tras emitir', 'No se puede: hace falta `XCTestExpectation`'],
            2, 'Si la secuencia termina, el `for await` sale y el método vuelve cuando ya ha procesado todos los valores.'),
          q('¿Por qué el registro de llamadas del spy es un `actor`?',
            ['Porque Swift Testing lo exige', 'Para que sea más rápido', 'Porque las clases no pueden contener arrays', 'Porque el protocolo es `Sendable` y el registro se escribe desde contextos concurrentes'],
            3, 'Un `actor` hace seguro el estado mutable sin locks ni `@unchecked Sendable`, y el fake sigue siendo `Sendable` por construcción.'),
          q('Un test de ViewModel necesita `import Shared` para construir un `Book` de Kotlin. ¿Qué indica?',
            ['Que todo va bien', 'Que un tipo de KMP se ha escapado del adaptador hacia la presentación', 'Que falta `@MainActor` en la suite', 'Que hay que volver a XCTest'],
            1, 'El ViewModel solo debería conocer tipos Swift. Si necesita Kotlin, la frontera del adaptador tiene una fuga.'),
        ],
      },
    ],
  });
})();
