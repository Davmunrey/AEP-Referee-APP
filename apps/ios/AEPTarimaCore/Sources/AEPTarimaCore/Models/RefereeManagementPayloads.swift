import Foundation

/// Parche para PATCH /referees/:id. Solo se envían los campos no nulos
/// (Codable omite los opcionales nil). `estado` no admite "Sancionado" (eso va
/// por el panel de sanciones).
public struct RefereePatch: Codable, Sendable {
    public var nombre: String?
    public var zona: String?
    public var nivel: String?
    public var estado: String?
    public var email: String?
    public var licencia: String?
    public var localidad: String?
    public var telefono: String?
    public var notas: String?

    public init(
        nombre: String? = nil, zona: String? = nil, nivel: String? = nil,
        estado: String? = nil, email: String? = nil, licencia: String? = nil,
        localidad: String? = nil, telefono: String? = nil, notas: String? = nil
    ) {
        self.nombre = nombre; self.zona = zona; self.nivel = nivel
        self.estado = estado; self.email = email; self.licencia = licencia
        self.localidad = localidad; self.telefono = telefono; self.notas = notas
    }
}

/// Cuerpo de POST /exams.
public struct NewExamPayload: Codable, Sendable {
    public var refereeId: String
    public var tipo: String
    public var nivelObjetivo: String
    public var fecha: String
    public var examinador: String
    public var puntuacion: Double?
    public var resultado: String?
    public var notas: String?

    public init(
        refereeId: String, tipo: String, nivelObjetivo: String, fecha: String,
        examinador: String, puntuacion: Double? = nil, resultado: String? = nil, notas: String? = nil
    ) {
        self.refereeId = refereeId; self.tipo = tipo; self.nivelObjetivo = nivelObjetivo
        self.fecha = fecha; self.examinador = examinador; self.puntuacion = puntuacion
        self.resultado = resultado; self.notas = notas
    }
}

/// Cuerpo de POST /referees/:id/sanctions.
public struct NewSanctionPayload: Codable, Sendable {
    public var motivo: String
    public var fechaInicio: String      // YYYY-MM-DD
    public var duration: String         // p. ej. "30d", "90d", "permanente"
    public var fechaFin: String?
    public var notas: String?

    public init(
        motivo: String, fechaInicio: String, duration: String,
        fechaFin: String? = nil, notas: String? = nil
    ) {
        self.motivo = motivo; self.fechaInicio = fechaInicio; self.duration = duration
        self.fechaFin = fechaFin; self.notas = notas
    }
}

/// Parche para PATCH /competitions/:id (campos parciales).
public struct CompetitionPatch: Codable, Sendable {
    public var nombre: String?
    public var tipo: String?
    public var fecha: String?
    public var fechaFin: String?
    public var sede: String?
    public var sesiones: Int?
    public var requeridos: Int?

    public init(
        nombre: String? = nil, tipo: String? = nil, fecha: String? = nil,
        fechaFin: String? = nil, sede: String? = nil, sesiones: Int? = nil, requeridos: Int? = nil
    ) {
        self.nombre = nombre; self.tipo = tipo; self.fecha = fecha
        self.fechaFin = fechaFin; self.sede = sede; self.sesiones = sesiones; self.requeridos = requeridos
    }
}

/// Cuerpo de POST /reports (subjectType "juez" para informes de un juez).
public struct NewReportPayload: Codable, Sendable {
    public var subjectType: String
    public var refereeId: String?
    public var titulo: String
    public var tipo: String
    public var contenido: String

    public init(
        subjectType: String, refereeId: String? = nil,
        titulo: String, tipo: String, contenido: String
    ) {
        self.subjectType = subjectType; self.refereeId = refereeId
        self.titulo = titulo; self.tipo = tipo; self.contenido = contenido
    }
}
