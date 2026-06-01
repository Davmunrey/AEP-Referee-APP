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
└── AEPTarimaCore/           ← Swift Package (Foundation puro, sin deps)
    ├── Package.swift
    ├── Sources/AEPTarimaCore/
    │   ├── Models/          ← Codable que espejan src/lib/types.ts
    │   │   (Enums, Referee, Competition, Roster, Approval, Session, Push)
    │   └── Networking/      ← APIClient, Endpoint, APIError, envelope, TokenProvider
    └── Tests/AEPTarimaCoreTests/   ← decoding + endpoints (XCTest)
```

`AEPTarimaCore` es **Foundation puro**: compila y se testea sin Xcode con
`swift build` / `swift test`. Contiene lo reutilizable y determinista (modelos
+ red). Las piezas con dependencias nativas (Supabase SDK, GRDB) y la UI viven
en el target de app, que depende de este paquete.

## Arquitectura (resumen del plan)

- **Auth híbrida:** la app inicia sesión con el **SDK de Supabase Swift**
  (`signInWithPassword`) y obtiene un JWT; llama a `/api/v1` con
  `Authorization: Bearer <jwt>`. El backend ya lo soporta (PR #1). No se leen
  tablas de Supabase directamente (RLS deny-by-default).
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

1. **Crear el target de app** en Xcode: *File ▸ New ▸ Project ▸ iOS App*
   (SwiftUI, nombre `AEPTarima`, iOS 17+). Guárdalo en `apps/ios/AEPTarima/`.
2. **Añadir el paquete local:** *File ▸ Add Package Dependencies ▸ Add Local* →
   selecciona `apps/ios/AEPTarimaCore`. Enlaza `AEPTarimaCore` al target.
3. **Dependencias del target de app** (SPM remoto):
   - `supabase-community/supabase-swift` (solo Auth: tokens).
   - `groue/GRDB.swift` (caché offline).
4. **Capabilities:** Push Notifications + Background Modes (Remote
   notifications); Face ID usa `LocalAuthentication` (añade `NSFaceIDUsageDescription`).
5. **Configuración** (Info.plist / xcconfig):
   - `API_BASE_URL` → `https://<tu-deploy>.vercel.app/api/v1`
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (para el SDK de auth)
6. **Estructura sugerida del target de app:**
   ```
   AEPTarima/
     App/            AEPTarimaApp.swift, AppEnvironment (DI)
     Auth/           SupabaseTokenProvider (implementa TokenProvider), Keychain, BiometricService
     Persistence/    GRDB cache (CacheRepository, migraciones)
     Push/           PushManager (APNs), NotificationRouter
     DesignSystem/   colores/tipografía espejo de src/lib/design-tokens.ts
     Features/       Dashboard, Competitions, Roster, Referees, Approvals,
                     Promotions, Exams, Reports, Analytics, Regulations, Admin, Scan
   ```

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
