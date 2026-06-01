import Foundation

/// Fuente de tokens de acceso para el `APIClient`. La implementación concreta
/// vive en el target de app (respaldada por el SDK de Supabase Swift +
/// Keychain): `signInWithPassword` emite el JWT, y el refresh token se guarda
/// en el Keychain protegido por biometría. Mantener esta abstracción aquí deja
/// el núcleo de red libre de dependencias y fácilmente testeable.
public protocol TokenProvider: Sendable {
    /// Token de acceso actual (JWT de Supabase), o nil si no hay sesión.
    func accessToken() async -> String?
    /// Intenta refrescar la sesión tras un 401. Devuelve el nuevo token o nil.
    func refresh() async -> String?
}
