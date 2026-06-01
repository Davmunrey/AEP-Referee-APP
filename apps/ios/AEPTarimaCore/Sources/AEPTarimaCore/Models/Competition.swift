import Foundation

/// Campeonato. Espeja `Competition` de src/lib/types.ts.
public struct Competition: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var nombre: String
    public var tipo: EventType
    public var fecha: String
    public var fechaFin: String
    public var sede: String
    public var sesiones: Int
    public var requeridos: Int
    public var confirmados: Int
    public var estado: EventStatus
    public var aprobacion: String
    public var zona: String?

    public init(
        id: String, nombre: String, tipo: EventType, fecha: String,
        fechaFin: String, sede: String, sesiones: Int, requeridos: Int,
        confirmados: Int, estado: EventStatus, aprobacion: String, zona: String? = nil
    ) {
        self.id = id; self.nombre = nombre; self.tipo = tipo; self.fecha = fecha
        self.fechaFin = fechaFin; self.sede = sede; self.sesiones = sesiones
        self.requeridos = requeridos; self.confirmados = confirmados
        self.estado = estado; self.aprobacion = aprobacion; self.zona = zona
    }
}
