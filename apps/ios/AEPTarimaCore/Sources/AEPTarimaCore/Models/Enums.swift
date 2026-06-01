import Foundation

// Enumeraciones del dominio. Los rawValue coinciden EXACTAMENTE con los valores
// que envía el backend (src/lib/types.ts) para que la (de)codificación JSON sea
// directa. Todas son `decodable-tolerant`: si llega un valor desconocido se
// mapea a `.unknown` en vez de fallar el decode de toda la respuesta.

public enum UserRole: String, Codable, Sendable, CaseIterable {
    case superAdmin = "super_admin"
    case delegadoJueces = "delegado_jueces"
    case delegadoZona = "delegado_zona"
    case soloVer = "solo_ver"
    case unknown

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = UserRole(rawValue: raw) ?? .unknown
    }

    /// ¿Puede aprobar propuestas y gestionar usuarios? (comité nacional)
    public var canApprove: Bool { self == .superAdmin || self == .delegadoJueces }
    /// ¿Puede crear/editar (no es solo lectura)?
    public var canEdit: Bool { self != .soloVer && self != .unknown }
}

public enum RefereeLevel: String, Codable, Sendable {
    case regional = "Regional"
    case nacional = "Nacional"
    case ipfCat1 = "IPF Cat. 1"
    case ipfCat2 = "IPF Cat. 2"
    case unknown

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = RefereeLevel(rawValue: raw) ?? .unknown
    }
}

public enum RefereeStatus: String, Codable, Sendable {
    case activo = "Activo"
    case inactivo = "Inactivo"
    case sancionado = "Sancionado"
    case unknown

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = RefereeStatus(rawValue: raw) ?? .unknown
    }
}

public enum EventType: String, Codable, Sendable {
    case aep1 = "AEP-1"
    case aep2 = "AEP-2"
    case aep3 = "AEP-3"
    case unknown

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = EventType(rawValue: raw) ?? .unknown
    }
}

public enum EventStatus: String, Codable, Sendable {
    case completo = "Completo"
    case incompleto = "Incompleto"
    case critico = "Crítico"
    case borrador = "Borrador"
    case unknown

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = EventStatus(rawValue: raw) ?? .unknown
    }
}

public enum ApprovalStatus: String, Codable, Sendable {
    case pendiente
    case aprobado
    case rechazado
    case unknown

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ApprovalStatus(rawValue: raw) ?? .unknown
    }
}
