import Foundation
import Observation
import AEPTarimaCore
import Supabase

/// Estado global de sesión y dependencias compartidas (auth + APIClient).
/// `@Observable` + `@MainActor` para conducir la UI con seguridad de hilos.
@MainActor
@Observable
final class SessionStore {
    enum State: Equatable {
        case loading
        case lockedBiometric        // hay sesión pero falta desbloqueo Face ID
        case signedOut(message: String?)
        case signedIn(SessionUser)
    }

    private(set) var state: State = .loading
    var isWorking = false

    let supabase: SupabaseClient
    let api: APIClient
    let router: NotificationRouter
    let push: PushManager

    init() {
        let supabase = SupabaseClient(
            supabaseURL: AppConfig.supabaseURL,
            supabaseKey: AppConfig.supabaseAnonKey
        )
        let api = APIClient(
            baseURL: AppConfig.apiBaseURL,
            tokens: SupabaseTokenProvider(client: supabase)
        )
        let router = NotificationRouter()
        self.supabase = supabase
        self.api = api
        self.router = router
        self.push = PushManager(api: api, router: router)
    }

    /// Al arrancar: si hay sesión persistida, pide Face ID (si está activado) y
    /// luego carga el usuario desde /meta; si no, va a login.
    func bootstrap() async {
        let hasSession = (try? await supabase.auth.session) != nil
        guard hasSession else { state = .signedOut(message: nil); return }

        if BiometricPreference.isEnabled, BiometricService.isAvailable {
            state = .lockedBiometric
            await unlockBiometric()
        } else {
            await loadCurrentUser()
        }
    }

    func unlockBiometric() async {
        guard await BiometricService.authenticate() else {
            state = .lockedBiometric
            return
        }
        await loadCurrentUser()
    }

    func signIn(email: String, password: String) async {
        isWorking = true
        defer { isWorking = false }
        do {
            _ = try await supabase.auth.signIn(email: email, password: password)
            await loadCurrentUser()
        } catch {
            state = .signedOut(message: "Credenciales incorrectas o sin conexión.")
        }
    }

    func signOut() async {
        await push.unregister()
        try? await supabase.auth.signOut()
        BiometricPreference.isEnabled = false
        state = .signedOut(message: nil)
    }

    /// Carga el usuario actual desde la API (valida que el Bearer funciona end-to-end).
    private func loadCurrentUser() async {
        do {
            let meta: AppMeta = try await api.send(.meta)
            if let user = meta.currentUser {
                state = .signedIn(user)
                await push.start()
            } else {
                state = .signedOut(message: "No se pudo cargar tu perfil.")
            }
        } catch APIError.unauthorized {
            state = .signedOut(message: "Tu sesión ha caducado.")
        } catch {
            state = .signedOut(message: "No se pudo conectar con el servidor.")
        }
    }
}
