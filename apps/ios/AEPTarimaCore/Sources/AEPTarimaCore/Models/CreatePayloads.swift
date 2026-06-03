import Foundation

/// Cuerpo de POST /competitions.
public struct NewCompetitionPayload: Codable, Sendable {
    public var nombre: String
    public var tipo: String        // AEP-1 | AEP-2 | AEP-3
    public var fecha: String       // YYYY-MM-DD
    public var fechaFin: String    // YYYY-MM-DD
    public var sede: String
    public var sesiones: Int
    public var requeridos: Int
    public var zona: String?

    public init(
        nombre: String, tipo: String, fecha: String, fechaFin: String,
        sede: String, sesiones: Int, requeridos: Int, zona: String? = nil
    ) {
        self.nombre = nombre; self.tipo = tipo; self.fecha = fecha
        self.fechaFin = fechaFin; self.sede = sede; self.sesiones = sesiones
        self.requeridos = requeridos; self.zona = zona
    }
}

/// Cuerpo de POST /referees.
public struct NewRefereePayload: Codable, Sendable {
    public var nombre: String
    public var zona: String
    public var nivel: String       // RefereeLevel rawValue
    public var estado: String      // RefereeStatus rawValue
    public var email: String?
    public var licencia: String?

    public init(
        nombre: String, zona: String, nivel: String, estado: String,
        email: String? = nil, licencia: String? = nil
    ) {
        self.nombre = nombre; self.zona = zona; self.nivel = nivel
        self.estado = estado; self.email = email; self.licencia = licencia
    }
}
