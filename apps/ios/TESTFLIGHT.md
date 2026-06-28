# Lanzar AEP Tarima a TestFlight

El pipeline ya está montado (`fastlane/Fastfile` lane `beta` + workflow
`.github/workflows/ios-release.yml`). Está **inerte hasta que añadas los
secrets**. Esta es la lista de lo que solo puedes hacer tú (cuenta de Apple).

## 0. Requisito previo: desplegar el backend
La app habla con `https://aep-tarima.vercel.app/api/v1`. El backend en `main` incluye
login móvil (`POST /auth/login`), RBAC zonal y APIs de tarima/push.

## 1. Apple Developer + App Store Connect (una vez)
1. Alta en el **Apple Developer Program** (99 $/año).
2. En **App Store Connect → Apps → +** crea la app:
   - Nombre: `AEP Tarima` · Bundle ID: **`es.aep.tarima`** · SKU: `aep-tarima`.
3. Crea una **API Key de App Store Connect** (Users and Access → Integrations →
   App Store Connect API → **Generate**, rol *App Manager*). Apunta **Key ID** e
   **Issuer ID** y descarga el `.p8` (solo se descarga una vez).

## 2. Certificados con fastlane match (una vez, en un Mac)
`match` guarda los certificados/perfiles cifrados en un repo git privado.
```bash
cd apps/ios
bundle install
bundle exec fastlane match appstore   # crea/sube certs; te pedirá MATCH_PASSWORD
```
Crea un repo git privado vacío para los certs y úsalo como `MATCH_GIT_URL`.

## 3. Secrets en GitHub (Settings → Secrets and variables → Actions)
| Secret | Valor |
|---|---|
| `ASC_KEY_ID` | Key ID de la API key |
| `ASC_ISSUER_ID` | Issuer ID |
| `ASC_KEY_CONTENT` | `.p8` en base64 → `base64 -i AuthKey_XXXX.p8 \| pbcopy` |
| `MATCH_GIT_URL` | URL del repo de certs |
| `MATCH_PASSWORD` | contraseña que pusiste en el paso 2 |
| `MATCH_GIT_BASIC_AUTHORIZATION` | `printf 'usuario:TOKEN' \| base64` (token con acceso al repo de certs) |

## 4. Lanzar la build
- **Manual:** GitHub → Actions → *iOS Release (TestFlight)* → **Run workflow**.
- **Por tag:** `git tag ios-v1.0.0 && git push origin ios-v1.0.0`.
- **En tu Mac (alternativa):** con esas variables en el entorno,
  `cd apps/ios && bundle exec fastlane beta`.

La build sube a TestFlight; en App Store Connect → TestFlight la asignas a
testers internos y la pruebas en el iPhone.

## Notas
- `AEPTarima.xcodeproj` lo genera XcodeGen (no se versiona); el CI lo crea solo.
- La sesión se guarda en Keychain (build firmado) → seguro en dispositivo.
- Versión/Build: `Fastfile` autoincrementa el build con el nº de run del CI.
