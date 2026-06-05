import Foundation
import Security
import Supabase

/// Almacén local de la sesión de Supabase (access + refresh token).
///
/// Usa **Keychain** cuando está disponible (dispositivo firmado → almacenamiento
/// seguro) y **cae a `UserDefaults`** si el Keychain no es accesible —por ejemplo
/// en builds sin firmar en el simulador, donde `SecItemAdd` devuelve
/// `errSecMissingEntitlement` y el almacén por defecto de supabase-swift falla
/// en silencio. Sin un almacén funcional, `signIn` obtiene la sesión pero no se
/// persiste, y `auth.session` lanza `sessionMissing` → la app no envía el Bearer
/// y el backend responde 401 ("sesión caducada").
struct AppAuthStorage: AuthLocalStorage {
    private let service = "es.aep.tarima.supabase.auth"
    private let fallbackPrefix = "sb-auth-"

    func store(key: String, value: Data) throws {
        if keychainSet(key, value) { return }
        UserDefaults.standard.set(value, forKey: fallbackPrefix + key)
    }

    func retrieve(key: String) throws -> Data? {
        if let data = keychainGet(key) { return data }
        return UserDefaults.standard.data(forKey: fallbackPrefix + key)
    }

    func remove(key: String) throws {
        keychainDelete(key)
        UserDefaults.standard.removeObject(forKey: fallbackPrefix + key)
    }

    // MARK: - Keychain (devuelve éxito; ante fallo, el llamador usa UserDefaults)

    private func baseQuery(_ key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }

    @discardableResult
    private func keychainSet(_ key: String, _ value: Data) -> Bool {
        SecItemDelete(baseQuery(key) as CFDictionary)
        var attributes = baseQuery(key)
        attributes[kSecValueData as String] = value
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess
    }

    private func keychainGet(_ key: String) -> Data? {
        var query = baseQuery(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    private func keychainDelete(_ key: String) {
        SecItemDelete(baseQuery(key) as CFDictionary)
    }
}
