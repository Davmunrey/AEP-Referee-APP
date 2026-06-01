import Foundation

/// Usuario de la sesión. Espeja `SessionUser` (GET /auth/me, GET /meta).
public struct SessionUser: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var nombre: String
    /// Etiqueta de rol legible (rol_label), p. ej. "Delegado de Zona".
    public var rol: String
    public var iniciales: String
    public var email: String
    public var role: UserRole
    public var zona: String?
}

/// Zona geográfica (GET /meta).
public struct Zone: Codable, Identifiable, Hashable, Sendable {
    public var code: String
    public var name: String
    public var id: String { code }
}

/// Metadatos de la app (GET /meta): usuario actual, zonas y niveles.
public struct AppMeta: Codable, Sendable {
    public var currentUser: SessionUser?
    public var zones: [Zone]?
    public var levels: [String]?
}
