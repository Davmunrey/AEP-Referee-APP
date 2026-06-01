import Foundation

/// Ficha de juez. Espeja la interfaz `Referee` de src/lib/types.ts.
/// Las fechas se mantienen como `String` (ISO `YYYY-MM-DD`); se parsean en la
/// capa de presentación para evitar fallos de decode por formatos mixtos.
public struct Referee: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var nombre: String
    public var zona: String
    public var nivel: RefereeLevel
    public var estado: RefereeStatus
    public var eventos: Int
    public var ultimo: String
    public var disp: Bool
    public var iniciales: String
    /// Cuenta de usuario del juez (profiles.id), si está registrado (migración 021).
    public var userId: String?
    public var email: String?
    public var licencia: String?
    public var localidad: String?
    public var telefono: String?
    public var genero: String?
    public var antiguedad: String?
    public var notas: String?
    public var ultimoFecha: String?
    public var excelMacroZone: String?

    public init(
        id: String, nombre: String, zona: String, nivel: RefereeLevel,
        estado: RefereeStatus, eventos: Int, ultimo: String, disp: Bool,
        iniciales: String, userId: String? = nil, email: String? = nil,
        licencia: String? = nil, localidad: String? = nil, telefono: String? = nil,
        genero: String? = nil, antiguedad: String? = nil, notas: String? = nil,
        ultimoFecha: String? = nil, excelMacroZone: String? = nil
    ) {
        self.id = id; self.nombre = nombre; self.zona = zona; self.nivel = nivel
        self.estado = estado; self.eventos = eventos; self.ultimo = ultimo
        self.disp = disp; self.iniciales = iniciales; self.userId = userId
        self.email = email; self.licencia = licencia; self.localidad = localidad
        self.telefono = telefono; self.genero = genero; self.antiguedad = antiguedad
        self.notas = notas; self.ultimoFecha = ultimoFecha
        self.excelMacroZone = excelMacroZone
    }
}

/// Sanción de un juez. Espeja `RefereeSanction` de types.ts (campos principales).
public struct RefereeSanction: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var refereeId: String
    public var refereeName: String
    public var zona: String
    public var motivo: String
    public var fechaInicio: String
    public var fechaFin: String
    public var status: String
    public var impuestaPorNombre: String
    public var notas: String?
}
