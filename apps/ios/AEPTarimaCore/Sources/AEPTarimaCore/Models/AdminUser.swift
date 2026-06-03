import Foundation

/// Cuenta de usuario (perfil). GET /admin/users devuelve filas en snake_case.
public struct AdminUser: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var email: String
    public var nombre: String
    public var rolLabel: String
    public var iniciales: String
    public var role: UserRole
    public var zona: String?
    public var activo: Bool
    public var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, email, nombre, iniciales, role, zona, activo
        case rolLabel = "rol_label"
        case createdAt = "created_at"
    }
}

/// Cuerpo de POST /admin/users para crear una cuenta.
public struct NewUserPayload: Codable, Sendable {
    public var email: String
    public var password: String
    public var nombre: String
    public var rolLabel: String
    public var role: String
    public var zona: String?

    public init(
        email: String, password: String, nombre: String,
        rolLabel: String, role: String, zona: String? = nil
    ) {
        self.email = email; self.password = password; self.nombre = nombre
        self.rolLabel = rolLabel; self.role = role; self.zona = zona
    }
}
