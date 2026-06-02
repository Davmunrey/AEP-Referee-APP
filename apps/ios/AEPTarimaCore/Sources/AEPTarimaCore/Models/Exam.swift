import Foundation

public enum ExamType: String, Codable, Sendable {
    case nuevoJuez = "Nuevo juez"
    case ascensoIPF = "Ascenso IPF"
    case recertificacion = "Recertificación"
    case unknown

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ExamType(rawValue: raw) ?? .unknown
    }
}

public enum ExamResult: String, Codable, Sendable {
    case aprobado = "Aprobado"
    case suspenso = "Suspenso"
    case pendiente = "Pendiente"
    case unknown

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ExamResult(rawValue: raw) ?? .unknown
    }
}

/// Examen arbitral. Espeja `RefereeExam` de src/lib/types.ts.
public struct RefereeExam: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var refereeId: String
    public var refereeName: String
    public var tipo: ExamType
    public var nivelObjetivo: RefereeLevel
    public var fecha: String
    public var examinador: String
    public var puntuacion: Double?
    public var puntuacionMaxima: Double
    public var resultado: ExamResult
    public var notas: String?
    public var createdAt: String?
}
