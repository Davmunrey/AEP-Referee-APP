# AEP Tarima — App iOS nativa (scaffold)

Cliente iOS **nativo (Swift/SwiftUI)** de AEP Tarima. La web en Vercel sigue
siendo el sistema principal; esta app es un cliente adicional que consume el
**mismo backend** (`/api/v1` + Supabase). Distribución prevista: **TestFlight**.

> ⚠️ Este scaffold se generó en un entorno Linux sin Xcode. Contiene el
> **núcleo compilable** (`AEPTarimaCore`) y la guía para montar el target de app
> SwiftUI en un **Mac con Xcode**. El `.xcodeproj` se crea en el Mac (ver abajo).

## Qué hay aquí

```
apps/ios/
├── README.md                ← este archivo
├── project.yml              ← XcodeGen: genera AEPTarima.xcodeproj
├── AEPTarimaCore/           ← Swift Package (Foundation puro, sin deps)
│   ├── Package.swift
│   ├── Sources/AEPTarimaCore/
│   │   ├── Models/          ← Codable que espejan src/lib/types.ts
│   │   └── Networking/      ← APIClient, Endpoint, APIError, envelope, TokenProvider
│   └── Tests/AEPTarimaCoreTests/   ← decoding + endpoints (XCTest)
└── AEPTarima/               ← target de app SwiftUI
    ├── Info.plist
    ├── Config/Config.xcconfig      ← API_HOST, SUPABASE_HOST, SUPABASE_ANON_KEY
    ├── App/                 ← AEPTarimaApp, RootView, AppConfig
    ├── Auth/                ← SessionStore, SupabaseTokenProvider, BiometricService
    └── Features/
        ├── Auth/LoginView.swift
        └── Home/HomeView.swift, HomeViewModel.swift
```

`AEPTarimaCore` es **Foundation puro**: compila y se testea sin Xcode con
`swift build` / `swift test`. El target `AEPTarima` (SwiftUI) depende del núcleo
y añade las piezas nativas (Supabase SDK para auth, GRDB para offline) y la UI.

## Arquitectura (resumen del plan)

- **Auth híbrida:** la app inicia sesión con el **SDK de Supabase Swift**
  (`signInWithPassword`) o, alternativamente, puede usar `POST /api/v1/auth/login`
  de la web (mismas cookies no aplican en nativo). Llama a `/api/v1` con
  `Authorization: Bearer <jwt>`.
- **`TokenProvider`** (en `Networking/`) abstrae la obtención/refresh del token;
  el target de app lo implementa con Supabase SDK + Keychain (refresh token
  protegido por Face ID).
- **`APIClient`** (actor) inyecta el Bearer, reintenta una vez tras 401
  refrescando, y decodifica el envelope `{ data: T }`.
- **Push (APNs):** el backend ya emite (PR #2/#3). La app registra el token vía
  `POST /api/v1/devices` (modelo `DeviceRegistration`) y enruta deep-links según
  `PushType`.
- **Offline:** caché read-through con GRDB en el target de app (rosters, jueces,
  normativa). Escrituras online-only en superficies de alto conflicto.

## Puesta en marcha en el Mac

1. **Genera el proyecto** con XcodeGen (el `project.yml` ya define target,
   dependencias SPM —Supabase, GRDB— y la app):
   ```bash
   brew install xcodegen
   cd apps/ios
   xcodegen generate
   open AEPTarima.xcodeproj
   ```
2. **Rellena `AEPTarima/Config/Config.xcconfig`** con tu despliegue:
   - `API_HOST` (sin esquema), `SUPABASE_HOST`, `SUPABASE_ANON_KEY`.
   - Las URLs `https://…` se componen en código (`AppConfig`), porque `.xcconfig`
     no permite escribir `//`.
3. **Firma:** selecciona tu *Team* en *Signing & Capabilities* (el bundle id por
   defecto es `es.aep.tarima`). Las capabilities de Push y Background ya están en
   el Info.plist; añade el *entitlement* de Push Notifications al firmar.
4. **Compila y ejecuta** en un simulador/dispositivo. El vertical slice actual:
   login (Supabase) → `/meta` → tabs Campeonatos (`/competitions`) + Perfil
   (toggle Face ID, cerrar sesión).

La web v1.5 añade compensación de jueces (`/competitions/:id/compensation`,
API `/api/v1/competitions/:id/compensation/*`). El cliente iOS aún no expone esta
superficie; los modelos y endpoints pueden añadirse en iteraciones futuras.

> El núcleo se puede testear aparte sin el proyecto: `cd AEPTarimaCore && swift test`.

## Distribución a TestFlight (Fastlane)

`apps/ios/fastlane/Fastfile` define la lane `beta` (genera el proyecto, firma con
**match**, sube a TestFlight con la **App Store Connect API key**). Se ejecuta a
mano (`bundle exec fastlane beta`) o por el workflow `iOS Release (TestFlight)`
(disparo manual o tag `ios-v*`).

Secrets necesarios en GitHub (Settings → Secrets → Actions):
- `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_CONTENT` (clave `.p8` en base64).
- `MATCH_GIT_URL`, `MATCH_PASSWORD`, `MATCH_GIT_BASIC_AUTHORIZATION` (repo de
  certificados gestionado con `fastlane match`).

Primer arranque de match (una vez, en el Mac): `bundle exec fastlane match appstore`.

## Ejemplo de uso del núcleo

```swift
let client = APIClient(
    baseURL: URL(string: "https://<deploy>.vercel.app/api/v1")!,
    tokens: SupabaseTokenProvider()   // implementa TokenProvider en el target de app
)
let meta: AppMeta = try await client.send(.meta)
let comps: [Competition] = try await client.send(.competitions)
try await client.sendIgnoringBody(.assign("c1", slotKey: "s1_central_0", refereeId: "j001"))
```

## Compilar y testear el núcleo (sin Xcode)

```bash
cd apps/ios/AEPTarimaCore
swift build
swift test
```

## Estado y siguientes pasos

- **Hecho:** modelos Codable + capa de red + tests del núcleo. Backend (Fase 0)
  ya soporta el cliente nativo (auth Bearer, `/devices`, push APNs).
- **Siguiente (en Mac):** target de app SwiftUI — `SupabaseTokenProvider`,
  login + Face ID, Dashboard (vertical slice), luego pantallas de lectura, el
  builder de tarima, push end-to-end, offline, escaneo VisionKit y TestFlight.

Plan completo (arquitectura, riesgos, roadmap por fases) en el archivo de plan
de la sesión.
