import Foundation

public enum ReportType: String, Codable, Sendable {
    case general = "General"
    case competicion = "Competición"
    case juez = "Juez"
    case incidencia = "Incidencia"
    case evaluacion = "Evaluación"
    case unknown

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ReportType(rawValue: raw) ?? .unknown
    }
}

public enum ReportSubjectType: String, Codable, Sendable {
    case competicion
    case juez
    case unknown

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ReportSubjectType(rawValue: raw) ?? .unknown
    }
}

/// Informe de incidencia/evaluación. Espeja `RefereeReport` de types.ts.
public struct RefereeReport: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var subjectType: ReportSubjectType
    public var zona: String?
    public var refereeId: String?
    public var refereeName: String?
    public var competitionId: String?
    public var competitionName: String?
    public var titulo: String
    public var tipo: ReportType
    public var evento: String?
    public var contenido: String
    public var adjuntoUrl: String?
    public var autor: String
    public var createdAt: String?
}
