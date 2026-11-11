/* Módulo 7 · Proyecto y herramientas */
(function () {
  'use strict';
  const { p, h, code, compare, tabs, note, list, steps, table, keys, q, S } = Curso.dsl;

  Curso.module({
    id: 'herramientas',
    order: 7,
    title: 'Proyecto y herramientas',
    short: 'Herramientas',
    icon: 'wrench',
    description: 'Cómo llega el framework de KMP a Xcode, cómo mantener builds rápidos y crashes legibles, y cómo trabajar con el equipo KMP con estilo, lint y un contrato revisado.',
    lessons: [
      // ─────────────────────────────────────────────────────────────────────
      {
        id: 'integracion-xcode',
        title: 'Integrar el framework KMP en Xcode',
        level: 'Intermedio',
        minutes: 14,
        tags: ['Xcode', 'Gradle', 'embedAndSignAppleFrameworkForXcode', 'XCFramework', 'SPM', 'CocoaPods', 'SKIE'],
        summary: 'Integración directa, paquete local, XCFramework con SPM o CocoaPods: qué elegir, cómo configurarlo y cómo evitar los tropiezos típicos.',
        blocks: [
          p('El módulo compartido se compila con Gradle a un framework de Apple (`Shared`). La decisión importante es **cómo llega ese framework a Xcode**: afecta a los tiempos de build, a quién necesita JDK y Gradle instalados, y a cómo se versiona el contrato entre equipos.'),
          table(['Opción', 'Cómo funciona', 'Encaja cuando'], [
            ['Integración directa', 'Una *Run Script* de Xcode llama a Gradle (`embedAndSignAppleFrameworkForXcode`) en cada build.', 'Monorepo y devs iOS que compilan también Kotlin. Es lo que configura el asistente de KMP.'],
            ['Paquete Swift local', 'El framework se consume desde un paquete Swift local del repo (Kotlin 2.0+).', 'Monorepo cuya app iOS ya se organiza en paquetes SPM.'],
            ['XCFramework + SPM remoto', 'Gradle genera un XCFramework versionado; Xcode lo consume como `binaryTarget` (KMMBridge lo automatiza).', 'Repos separados: el equipo iOS no compila Kotlin y consume versiones publicadas.'],
            ['CocoaPods', 'Plugin `kotlin("native.cocoapods")` y un `Podfile`.', 'Solo proyectos heredados: el trunk de CocoaPods pasa a solo lectura el 2 de diciembre de 2026.'],
          ]),
          note('new', 'CocoaPods y SwiftPM import', 'Desde el 2 de diciembre de 2026 el trunk de CocoaPods no acepta pods ni versiones nuevas (los existentes siguen resolviéndose). Si hoy usáis CocoaPods para que **Kotlin** dependa de librerías iOS, Kotlin 2.4 incorpora *SwiftPM import*: declarar paquetes Swift como dependencias desde Gradle, con guía oficial de migración. Si lo usáis para entregar el framework a la app, pasad a integración directa o a SPM.'),
          h('Configuración del framework en Gradle'),
          code('gradle', S`
            // shared/build.gradle.kts
            kotlin {
                listOf(
                    iosArm64(),            // dispositivos
                    iosSimulatorArm64(),   // simulador en Macs con Apple Silicon
                ).forEach { target ->
                    target.binaries.framework {
                        baseName = "Shared"
                        isStatic = true    // enlace estático: sin framework dinámico que cargar al arrancar
                        // Exporta a Swift solo los módulos cuya API necesita ver la app.
                        // export() requiere que la dependencia sea "api":
                        // export(project(":core:domain"))
                    }
                }
            }
          `),
          p('Cada módulo exportado engorda la cabecera que ve Swift y el tiempo de compilación. Exporta lo que la app usa de verdad (normalmente el dominio) y deja dentro los detalles de datos (Ktor, SQLDelight…).'),
          h('Integración directa paso a paso'),
          steps([
            'En el target de la app: *Build Phases* → **+** → *New Run Script Phase*, y arrástrala **antes** de *Compile Sources*.',
            'Pega el script de abajo, ajustando la ruta a la raíz del proyecto Gradle.',
            'En *Build Settings*, pon **User Script Sandboxing** (`ENABLE_USER_SCRIPT_SANDBOXING`) a `No`: el script lee y escribe fuera del sandbox de Xcode.',
            'Si el proyecto no lo generó el asistente de KMP, revisa también *Framework Search Paths* (`$(SRCROOT)/../shared/build/xcode-frameworks/$(CONFIGURATION)/$(SDK_NAME)`) y *Other Linker Flags* (`-framework Shared`).',
            'Compila desde Xcode. Si dice que la tarea no existe, revisa que declaras `binaries.framework` en Gradle: sin él, la tarea no se registra.',
          ]),
          code('bash', S`
            # Build Phase "Compile Kotlin Framework" (antes de Compile Sources)
            cd "$SRCROOT/.."
            ./gradlew :shared:embedAndSignAppleFrameworkForXcode
          `),
          p('La tarea compila solo lo que Xcode está construyendo (configuración Debug o Release, simulador o dispositivo), así que no tienes que generar frameworks para todas las arquitecturas en cada cambio.'),
          note('warn', 'Xcode no ve tu JDK', 'Xcode lanza el script con un entorno mínimo: puede no encontrar Java o usar un JDK distinto al de tu terminal. Fija el JDK del daemon de Gradle (por ejemplo `org.gradle.java.home` en tu `~/.gradle/gradle.properties`, no en el del repo) y, si un build falla desde Xcode pero no desde la terminal, sospecha primero del entorno.'),
          h('Distribución como XCFramework + SPM'),
          tabs([
            ['shared/build.gradle.kts', 'gradle', S`
              import org.jetbrains.kotlin.gradle.plugin.mpp.apple.XCFramework

              kotlin {
                  val xcf = XCFramework("Shared")
                  listOf(iosArm64(), iosSimulatorArm64()).forEach { target ->
                      target.binaries.framework {
                          baseName = "Shared"
                          isStatic = true
                          xcf.add(this)
                      }
                  }
              }
              // ./gradlew :shared:assembleSharedReleaseXCFramework
            `],
            ['Package.swift', 'swift', S`
              // swift-tools-version: 6.0
              import PackageDescription

              let package = Package(
                  name: "Shared",
                  platforms: [.iOS(.v17)],
                  products: [
                      .library(name: "Shared", targets: ["Shared"]),
                  ],
                  targets: [
                      .binaryTarget(
                          name: "Shared",
                          url: "https://example.com/releases/1.4.0/Shared.xcframework.zip",
                          checksum: "<salida de: swift package compute-checksum Shared.xcframework.zip>"
                      ),
                  ]
              )
            `],
          ]),
          p('Con este modelo el contrato tiene **versión**: la app declara qué versión de `Shared` usa y se actualiza a propósito, leyendo el CHANGELOG. KMMBridge automatiza el empaquetado, la subida y la actualización del `Package.swift`.'),
          h('Versiones fijadas: Kotlin, SKIE y compañía'),
          p('SKIE se engancha al compilador de Kotlin, así que cada versión de SKIE soporta un rango concreto de versiones de Kotlin y el soporte para una versión nueva puede tardar en llegar. Antes de subir Kotlin, comprueba la compatibilidad y sube ambos a la vez.'),
          code('text', S`
            # gradle/libs.versions.toml
            [versions]
            kotlin = "x.y.z"   # súbelo solo junto a skie…
            skie = "x.y.z"     # …a una pareja que figure en la tabla de compatibilidad de SKIE

            [plugins]
            kotlinMultiplatform = { id = "org.jetbrains.kotlin.multiplatform", version.ref = "kotlin" }
            skie = { id = "co.touchlab.skie", version.ref = "skie" }
          `),
          list([
            'Agrupa en Renovate o Dependabot las actualizaciones de Kotlin y SKIE para que lleguen en el mismo PR.',
            'Un build de CI que compile el framework de iOS en cada PR del módulo compartido detecta la incompatibilidad antes que el equipo iOS.',
          ]),
          h('Crashes legibles'),
          p('Sube los dSYM a tu herramienta de crashes y comprueba que incluyen los símbolos de Kotlin (con framework estático van dentro del binario de la app). Una excepción Kotlin no capturada termina la app con un `abort` cuya traza no muestra la excepción original: **CrashKiOS** (de Touchlab) envía la traza de Kotlin a Crashlytics o Bugsnag. Y lo más importante: que no lleguen excepciones a Swift sin `@Throws` (ver [errores entre lenguajes](#/l/sealed-errores)).'),
          h('Builds más rápidos'),
          list([
            'Activa la caché de configuración y la de build de Gradle (`org.gradle.configuration-cache=true`, `org.gradle.caching=true`) si vuestros plugins las soportan.',
            'En el día a día, framework de Debug: compila mucho más rápido que Release. Mide el rendimiento con Release.',
            'En CI, cachea `~/.gradle` y `~/.konan` (toolchain y dependencias de Kotlin/Native): la primera descarga es grande.',
            'Si los devs iOS no tocan Kotlin a menudo, un XCFramework publicado les ahorra compilar Kotlin en cada build limpio.',
          ]),
          keys([
            'Monorepo: integración directa (o paquete local). Repos separados: XCFramework versionado por SPM.',
            'CocoaPods es legado: trunk en solo lectura desde el 2-12-2026.',
            'Run Script antes de *Compile Sources* y *User Script Sandboxing* a `No`.',
            'Kotlin y SKIE se actualizan juntos y fijados en el version catalog.',
            'dSYM con símbolos de Kotlin y CrashKiOS para que los crashes del framework sean legibles.',
          ]),
        ],
        quiz: [
          q('El equipo iOS trabaja en otro repo y no quiere instalar JDK ni compilar Kotlin. ¿Qué integración encaja mejor?', [
            'Integración directa con Run Script',
            'XCFramework versionado consumido como paquete SPM remoto (`binaryTarget`)',
            'Copiar el código Kotlin dentro del proyecto Xcode',
            'Publicar un pod nuevo en el trunk de CocoaPods',
          ], 1, 'El XCFramework publicado se consume como cualquier dependencia binaria: sin Gradle en la máquina iOS y con versiones explícitas.'),
          q('Añades el Run Script con `embedAndSignAppleFrameworkForXcode` y falla por permisos al escribir ficheros. ¿Qué revisas primero?', [
            'Que el script esté después de *Compile Sources*',
            'Que *User Script Sandboxing* (`ENABLE_USER_SCRIPT_SANDBOXING`) esté en `No`',
            'Que el framework sea dinámico',
            'Que uses un simulador Intel',
          ], 1, 'Con el sandbox de scripts activado, Gradle no puede escribir donde necesita. Además, el script debe ir antes de *Compile Sources*.'),
          q('¿Qué cambia el 2 de diciembre de 2026 con CocoaPods?', [
            '`pod install` deja de funcionar para siempre',
            'El trunk pasa a solo lectura: no se publican pods ni versiones nuevas, aunque los existentes siguen resolviéndose',
            'Apple lo integra en Xcode',
            'Nada',
          ], 1, 'Los proyectos existentes no se rompen ese día, pero no podréis publicar versiones nuevas por esa vía: planificad la migración.'),
          q('Vas a subir la versión de Kotlin en un proyecto con SKIE. ¿Qué haces primero?', [
            'Subir Kotlin y esperar a que compile',
            'Comprobar que hay una versión de SKIE compatible con esa versión de Kotlin y subir ambas juntas',
            'Quitar SKIE del proyecto',
            'Pasar a Swift export en producción',
          ], 1, 'SKIE depende del compilador de Kotlin; si aún no soporta la versión nueva, el build de iOS falla. Swift export sigue en Alpha: no es un sustituto para producción.'),
        ],
      },

      // ─────────────────────────────────────────────────────────────────────
      {
        id: 'equipo',
        title: 'Estilo, lint y trabajo con el equipo KMP',
        level: 'Básico',
        minutes: 10,
        tags: ['API Design Guidelines', 'swift-format', 'SwiftLint', 'modularización', 'contrato', 'ADR'],
        summary: 'Swift idiomático y automatizado, una app modular y un contrato con el equipo KMP que se revisa antes de que llegue a la app.',
        blocks: [
          p('En un proyecto KMP, la app iOS vive encima de un contrato escrito por otro equipo y en otro lenguaje. La mayoría de los problemas no son de código, sino de **cómo trabajan los dos equipos**: nombres que chocan, errores que nadie declaró, cambios de API que se descubren al compilar. Esta lección va de hábitos.'),
          h('Swift idiomático: las API Design Guidelines'),
          p('La regla número uno de las [API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/) es la **claridad en el punto de uso**: el código se lee como una frase, sin palabras redundantes, con etiquetas que explican el papel de cada argumento.'),
          compare('swift', S`
            func getBookData(bookId: String) async throws -> BookSummary
            func favorite(b: BookSummary, flag: Bool)
            var bookList: [BookSummary]
            let IS_LOADING = false
          `, S`
            func book(id: String) async throws -> BookSummary
            func setFavorite(_ isFavorite: Bool, for book: BookSummary)
            var books: [BookSummary]
            var isLoading = false
          `, {
            bad: 'Prefijos `get`, tipos repetidos en el nombre, etiquetas crípticas y convenciones de otros lenguajes.',
            good: 'Se lee en el punto de uso: `service.book(id: "42")`, `setFavorite(true, for: book)`. Booleanos con `is`/`has`, colecciones en plural.'
          }),
          h('Formato y lint automáticos'),
          p('No discutáis estilo en los PR: que lo decida una herramienta. `swift-format` viene con la toolchain de Swift desde Xcode 16 (también en *Editor → Structure → Format File*); SwiftLint añade reglas más ricas si las necesitáis. Lo importante es ejecutarlo en local (pre-commit) y en CI.'),
          code('bash', S`
            # swift-format viene con la toolchain (Xcode 16+); configúralo con .swift-format
            swift format lint --recursive --strict Sources/
            swift format --in-place --recursive Sources/
          `),
          h('Swift 6 y política de avisos'),
          list([
            '**Swift 6 language mode** en los targets nuevos: los *data races* pasan a ser errores de compilación.',
            '**Cero warnings en la rama principal**: un warning nuevo es una conversación, no ruido. Si aún no llegáis a cero, al menos que no crezcan.',
            'Con las versiones recientes de Swift podéis subir a error grupos concretos de avisos (SE-0443) en lugar de todo o nada con *Treat Warnings as Errors*.',
          ]),
          h('Modulariza la app con paquetes Swift locales'),
          code('text', S`
            App/                      ← target de la app: composition root y navegación
            Packages/
              DesignSystem/           ← colores, tipografía, componentes
              LibraryFeature/         ← vistas, ViewModels y protocolo LibraryService
              LibraryKMPAdapter/      ← KMPLibraryService: el único que importa Shared
              TestSupport/            ← fakes y datos de ejemplo
            shared/                   ← módulo KMP (Gradle)
          `),
          p('Las features no dependen de `Shared`: compilan rápido, sus previews no enlazan KMP y sus tests usan fakes. Solo el adaptador (o el target de la app, si usáis integración directa) importa el framework. Ese límite lo vigila el compilador, no la disciplina.'),
          h('Contrato primero con el equipo KMP'),
          list([
            'Revisad la **API Swift generada** en cada PR que toque la API pública del módulo compartido (la cabecera que ve Xcode o la interfaz de Swift export): es vuestro contrato real.',
            '`@Throws` en toda función pública que pueda fallar; en las `suspend`, incluyendo `CancellationException`.',
            'Nombres que no choquen con Swift: nada de `Task`, `Result`, `Error`, `Data` o `URL` en la API pública. En Xcode 27 los selectores de módulo (`Shared::Task`) desambiguan, pero es mejor evitar el choque.',
            'Nada de interfaces genéricas ni de depender de argumentos por defecto en la API pensada para Swift.',
            'Cambios incompatibles = versión mayor, entrada en el CHANGELOG y aviso al equipo iOS **antes** de publicar.',
          ]),
          code('kotlin', S`
            @file:OptIn(ExperimentalObjCName::class, ExperimentalObjCRefinement::class)

            package com.example.library

            import kotlin.experimental.ExperimentalObjCName
            import kotlin.experimental.ExperimentalObjCRefinement
            import kotlin.native.HiddenFromObjC
            import kotlin.native.ObjCName

            // En Android se llama Task; Swift la verá como ReadingTask
            // (mejor aún: no llamarla Task en el código compartido)
            @ObjCName(swiftName = "ReadingTask")
            data class Task(val id: String, val title: String)

            class LibraryContainer(/* ... */) {
                // Solo para tests de Kotlin: que no aparezca en la API de Swift
                @HiddenFromObjC
                fun resetDatabaseForTests() { /* ... */ }
            }
          `, 'Dar forma a la API que ve Swift'),
          p('`@ShouldRefineInSwift` completa el kit: marca la declaración como privada para Swift (la verá con el prefijo `__`) para que escribáis encima una envoltura más idiomática en una extensión. Igual que `@HiddenFromObjC`, requiere optar por `ExperimentalObjCRefinement`.'),
          note('kmp', 'Un CHANGELOG pensado para iOS', 'Versionad el módulo compartido con SemVer y escribid el CHANGELOG pensando en quien lo consume desde Swift: «`GetBookUseCase` ahora lanza `LibraryException` con `NotFound`» es información que el equipo iOS necesita **antes** de actualizar, no después de un crash.'),
          h('Decisiones por escrito (ADR)'),
          p('Documentad en ADRs cortos las decisiones que afectan a ambos equipos: el puente (SKIE o Swift export), ViewModels nativos o compartidos, cómo se modelan los errores, la estrategia de integración en Xcode. Dentro de seis meses alguien preguntará «¿por qué no usamos Swift export?» y la respuesta estará escrita, con su fecha y su contexto (en 2026, Swift export era Alpha).'),
          note('tip', 'Checklist de PR', 'Usa la [checklist](#/checklist) como plantilla de revisión para cualquier feature que consuma el módulo KMP.'),
          keys([
            'Claridad en el punto de uso: sin `get`, sin tipos repetidos, etiquetas que se leen como frases.',
            'Formato y lint automáticos (swift-format o SwiftLint) en pre-commit y CI; Swift 6 y cero warnings nuevos.',
            'Features en paquetes Swift que no importan `Shared`; solo el adaptador toca KMP.',
            'Revisad la API Swift generada en los PR del módulo compartido: es el contrato real.',
            'SemVer, CHANGELOG para iOS y ADRs para las decisiones entre equipos.',
          ]),
        ],
        quiz: [
          q('Según las API Design Guidelines de Swift, ¿qué firma es más idiomática?', [
            '`func getBookData(bookId: String)`',
            '`func book(id: String)`',
            '`func fetchBookDataById(_ bookId: String)`',
            '`func BOOK(id: String)`',
          ], 1, 'En el punto de uso se lee `service.book(id: "42")`: sin `get` ni palabras que repiten el tipo.'),
          q('El equipo KMP quiere publicar una clase `Result` en la API compartida. ¿Qué les propones?', [
            'Nada, Swift lo resuelve solo',
            'Otro nombre (o `@ObjCName`) para no ocultar `Swift.Result` en todo archivo que importe `Shared`',
            'Hacerla genérica para que sea más flexible',
            'Marcarla con `@Throws`',
          ], 1, 'Un tipo `Result` en `Shared` compite con el de la biblioteca estándar en cada archivo que lo importe. Además, los genéricos se degradan al pasar a Swift.'),
          q('En una app modularizada, ¿qué módulo debería ser el único que importe `Shared`?', [
            'Todos los de features',
            'El adaptador (p. ej. `LibraryKMPAdapter`) o, con integración directa, el target de la app',
            'El DesignSystem',
            'Los tests de UI',
          ], 1, 'Si solo el adaptador ve KMP, las features compilan y se previsualizan sin el framework, y cambiar de puente solo toca un sitio.'),
          q('¿Por qué revisar la API Swift generada en los PR del módulo compartido?', [
            'Por curiosidad',
            'Porque es el contrato que consume iOS: ahí se ven `KotlinInt`, genéricos perdidos, nombres que chocan o funciones sin `@Throws` antes de que lleguen a la app',
            'Porque Xcode no compila sin esa revisión',
            'Para medir el tamaño del binario',
          ], 1, 'Detectarlo en el PR de Kotlin cuesta minutos; descubrirlo al actualizar la app cuesta un sprint.'),
        ],
      },
    ],
  });
})();
