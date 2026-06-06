import Foundation

/// Categoría de una sesión (género + pesos). Espeja `RosterCategoria`.
public struct RosterCategoria: Codable, Hashable, Sendable {
    public var genero: String
    public var pesos: String

    public init(genero: String, pesos: String) {
        self.genero = genero
        self.pesos = pesos
    }
}

/// Rol dentro de una sesión (con nº de plazas). Espeja `RosterRole`.
public struct RosterRole: Codable, Hashable, Sendable {
    public var rol: String
    public var slots: Int
    /// Clave del rol (central, lateral, ordenador, speaker, control, jurado, …).
    public var key: String

    public init(rol: String, slots: Int, key: String) {
        self.rol = rol
        self.slots = slots
        self.key = key
    }
}

/// Sesión de una tarima. Espeja `RosterSession` de types.ts.
public struct RosterSession: Codable, Hashable, Sendable {
    public var sesion: String
    public var nombre: String
    public var dia: String
    public var categorias: [RosterCategoria]
    public var horarioCompeticion: String
    public var horarioPesaje: String
    public var roles: [RosterRole]
    public var pesajeRoles: [RosterRole]

    public init(
        sesion: String, nombre: String, dia: String,
        categorias: [RosterCategoria], horarioCompeticion: String,
        horarioPesaje: String, roles: [RosterRole], pesajeRoles: [RosterRole]
    ) {
        self.sesion = sesion
        self.nombre = nombre
        self.dia = dia
        self.categorias = categorias
        self.horarioCompeticion = horarioCompeticion
        self.horarioPesaje = horarioPesaje
        self.roles = roles
        self.pesajeRoles = pesajeRoles
    }
}

/// `assignments` es un mapa slotKey -> refereeId (puede venir con null).
public typealias AssignmentsMap = [String: String?]

/// Respuesta de GET /competitions/:id/roster.
public struct RosterPayload: Codable, Sendable {
    public var template: [RosterSession]
    public var assignments: AssignmentsMap
}
