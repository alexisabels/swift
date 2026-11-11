(function () {
  'use strict';
  const { S } = Curso.dsl;

  Curso.setArchitecture({
    layers: [
      {
        id: 'view',
        name: 'Vista SwiftUI',
        short: 'Vista',
        side: 'swift',
        role: 'Pinta el estado que le da el ViewModel y le comunica lo que hace el usuario. Nada más.',
        does: [
          'Componer subvistas pequeñas y reutilizables',
          'Atar el trabajo a su ciclo de vida con `.task` y `.refreshable`',
          'Accesibilidad, animaciones y layout'
        ],
        avoid: [
          'Importar `Shared` o usar tipos de Kotlin',
          'Llamar a casos de uso o decidir reglas de negocio',
          'Crear sus dependencias (service locators)'
        ],
        code: S`
          struct BookRow: View {
              let book: BookSummary   // tipo Swift, no Kotlin

              var body: some View {
                  Label(book.title, systemImage: book.isFavorite ? "star.fill" : "book")
              }
          }
        `,
        lesson: 'estado'
      },
      {
        id: 'viewmodel',
        name: 'ViewModel',
        short: 'ViewModel',
        side: 'swift',
        role: 'Convierte lo que ofrece el servicio en estado de pantalla y traduce las intenciones del usuario en llamadas. Es `@MainActor` y `@Observable`.',
        does: [
          'Modelar el estado como enum (cargando, datos, vacío, error)',
          'Orquestar llamadas `async` y su cancelación',
          'Comportamiento de pantalla: antirrebote, actualizaciones optimistas'
        ],
        avoid: [
          'Conocer Ktor, SQLDelight o cualquier tipo de Kotlin',
          'Duplicar reglas de negocio que ya están en KMP',
          'Navegar por su cuenta (eso es del Router)'
        ],
        code: S`
          @MainActor
          @Observable
          final class LibraryViewModel {
              private let service: any LibraryService   // protocolo Swift

              func refresh() async {
                  do throws(LibraryFailure) {
                      try await service.refresh()
                  } catch {
                      // estado de error para la vista
                  }
              }
          }
        `,
        lesson: 'p3-viewmodel'
      },
      {
        id: 'adapter',
        name: 'Adaptador',
        short: 'Adaptador',
        side: 'swift',
        role: 'La frontera con Kotlin: implementa protocolos Swift llamando a KMP, mapea modelos a structs `Sendable` y traduce errores.',
        does: [
          'Ser, junto al composition root, el único código que importa `Shared`',
          'Convertir `Flow` en `AsyncStream` y `suspend` en `async throws`',
          'Traducir excepciones de Kotlin a un enum Swift'
        ],
        avoid: [
          'Estado de pantalla o lógica de presentación',
          'Reglas de negocio (van en Kotlin)',
          'Dejar que un tipo de Kotlin suba hacia el ViewModel'
        ],
        code: S`
          func book(id: String) async throws(LibraryFailure) -> BookSummary {
              let book = try await translatingErrors {
                  try await container.getBook.invoke(id: id)
              }
              return BookSummary(book)   // Book (Kotlin) → BookSummary (Swift)
          }
        `,
        lesson: 'capa-adaptadora'
      },
      {
        id: 'root',
        name: 'Composition root',
        short: 'Composition root',
        side: 'swift',
        role: 'Crea el grafo de dependencias una sola vez al arrancar (contenedor de KMP, adaptadores, servicios de plataforma) y lo pasa hacia abajo.',
        does: [
          'Inicializar KMP (y Koin, si se usa) una sola vez',
          'Elegir implementaciones reales o fakes (UI tests, previews)',
          'Inyectar por `init` o por el entorno'
        ],
        avoid: [
          'Convertirse en un singleton global al que todo el mundo llama',
          'Contener lógica de negocio o de presentación'
        ],
        code: S`
          static func live() -> AppDependencies {
              let container = LibraryContainer(
                  tokenStorage: KeychainTokenStorage(),
                  baseUrl: "https://api.example.com"
              )
              return AppDependencies(library: KMPLibraryService(container: container))
          }
        `,
        lesson: 'dependencias'
      },
      {
        id: 'platform',
        name: 'Servicios de plataforma',
        short: 'Plataforma',
        side: 'swift',
        role: 'Implementaciones en Swift de interfaces que define Kotlin: Keychain, analítica, notificaciones, biometría…',
        does: [
          'Usar APIs de Apple (Security, UserNotifications, LocalAuthentication)',
          'Cumplir el contrato de la interfaz de Kotlin al pie de la letra'
        ],
        avoid: [
          'Decidir cuándo se usan (eso lo decide el código compartido)',
          'Retener con fuerza objetos de Kotlin en closures (ciclos de memoria)'
        ],
        code: S`
          final class KeychainTokenStorage: TokenStorage {   // interfaz de Kotlin
              func read() -> String? { /* SecItemCopyMatching */ nil }
              func write(token: String?) { /* SecItemAdd */ }
          }
        `,
        lesson: 'dependencias'
      },
      {
        id: 'domain',
        name: 'Dominio (KMP)',
        short: 'Dominio',
        side: 'kotlin',
        role: 'Reglas de negocio compartidas con Android: entidades, casos de uso, interfaces de repositorio y errores de dominio.',
        does: [
          'Validaciones y reglas (por ejemplo, búsqueda mínima de dos letras)',
          'Errores como `sealed` y declarados con `@Throws`',
          'Interfaces que implementan los datos o la plataforma'
        ],
        avoid: [
          'Depender de Ktor, SQLDelight o de una plataforma concreta',
          'Devolver textos ya formateados para la UI'
        ],
        lang: 'kotlin',
        code: S`
          class SearchBooksUseCase(private val repository: BookRepository) {
              @Throws(LibraryException::class, CancellationException::class)
              suspend operator fun invoke(query: String): List<Book> {
                  val text = query.trim()
                  return if (text.length < 2) emptyList() else repository.search(text)
              }
          }
        `,
        lesson: 'p1-contrato'
      },
      {
        id: 'data',
        name: 'Datos (KMP)',
        short: 'Datos',
        side: 'kotlin',
        role: 'Implementa los repositorios: red con Ktor, persistencia con SQLDelight o Room, caché y mapeo de DTO a dominio.',
        does: [
          'Offline-first: la base de datos como fuente de verdad',
          'Traducir errores técnicos a errores de dominio',
          'Hacer el trabajo pesado fuera del hilo principal'
        ],
        avoid: [
          'Exponer DTO o tipos de Ktor al dominio o a Swift',
          'Lanzar excepciones técnicas hacia arriba'
        ],
        lang: 'kotlin',
        code: S`
          override suspend fun refresh() = withContext(Dispatchers.IO) {
              try {
                  dao.replaceAll(api.fetchBooks().map { it.toDomain() })
              } catch (e: CancellationException) {
                  throw e
              } catch (e: IOException) {   // kotlinx.io
                  throw LibraryException(LibraryError.Offline)
              }
          }
        `,
        lesson: 'sealed-errores'
      }
    ],
    game: [
      { item: 'Una regla: no se pueden tener más de tres libros reservados a la vez.', answer: 'domain', why: 'Es una regla de negocio que debe cumplirse igual en Android e iOS: vive en un caso de uso de Kotlin.' },
      { item: 'La petición HTTP a `/books` con Ktor.', answer: 'data', why: 'El acceso a red es un detalle de implementación de los repositorios del módulo compartido.' },
      { item: 'Guardar el token de sesión en el Keychain.', answer: 'platform', why: 'Kotlin define la interfaz `TokenStorage`; iOS la implementa con las APIs de Security.' },
      { item: 'Convertir `Flow<List<Book>>` en `AsyncStream<[BookSummary]>`.', answer: 'adapter', why: 'Es traducción entre lenguajes: justo el trabajo de la frontera.' },
      { item: 'Decidir si la pantalla enseña «Cargando», la lista, «Vacío» o un error.', answer: 'viewmodel', why: 'Es estado de pantalla, derivado de los datos y errores que recibe del servicio.' },
      { item: 'Pintar una estrella amarilla en los libros favoritos.', answer: 'view', why: 'Es pura presentación a partir del estado (`book.isFavorite`).' },
      { item: 'Crear `LibraryContainer` y `KMPLibraryService` al arrancar la app.', answer: 'root', why: 'El grafo de dependencias se construye una vez en el punto de entrada.' },
      { item: 'Traducir `LibraryException(Offline)` a `LibraryFailure.offline`.', answer: 'adapter', why: 'El adaptador es el único que conoce las excepciones de Kotlin y las convierte en errores Swift.' },
      { item: 'Guardar en SQLDelight los libros descargados para usarlos sin conexión.', answer: 'data', why: 'La persistencia y la estrategia offline-first son responsabilidad de los repositorios compartidos.' },
      { item: 'Esperar 300 ms antes de buscar mientras el usuario escribe.', answer: 'viewmodel', why: 'El antirrebote es comportamiento de pantalla: depende de cómo interactúa el usuario con esta UI.' },
      { item: 'Que VoiceOver lea «Favorito» en cada fila marcada.', answer: 'view', why: 'La accesibilidad se resuelve en la vista con `accessibilityLabel` y agrupando elementos.' },
      { item: 'Ordenar los libros por título (igual en Android e iOS).', answer: 'domain', why: 'Si las dos plataformas deben mostrar el mismo orden, es una regla compartida.' },
      { item: 'Pedir permiso de notificaciones con `UNUserNotificationCenter`.', answer: 'platform', why: 'Es una API exclusiva de Apple; si el código compartido la necesita, la pide a través de una interfaz.' },
      { item: 'Usar `FakeLibraryService` en lugar del real al ejecutar los UI tests.', answer: 'root', why: 'Elegir implementaciones es trabajo del composition root, no de cada pantalla.' }
    ]
  });
})();
