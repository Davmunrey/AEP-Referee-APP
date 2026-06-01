import Foundation
import LocalAuthentication

/// Desbloqueo con Face ID / Touch ID. Solo es una verificación de presencia del
/// dueño del dispositivo: la sesión real la mantiene el SDK de Supabase. Se usa
/// como puerta opcional al abrir la app si el usuario activó el biométrico.
enum BiometricService {
    /// ¿Hay biometría disponible y configurada en el dispositivo?
    static var isAvailable: Bool {
        var error: NSError?
        return LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    /// Pide autenticación biométrica. Devuelve true si el usuario la supera.
    static func authenticate(reason: String = "Desbloquea AEP Tarima") async -> Bool {
        let context = LAContext()
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else {
            return false
        }
        return await withCheckedContinuation { continuation in
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { ok, _ in
                continuation.resume(returning: ok)
            }
        }
    }
}

/// Preferencia local (no sensible) de si el usuario activó el desbloqueo biométrico.
enum BiometricPreference {
    private static let key = "aep.biometricUnlockEnabled"
    static var isEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: key) }
        set { UserDefaults.standard.set(newValue, forKey: key) }
    }
}
