import Foundation

/// Entrada del registro de actividad. Espeja `ActivityItem` de types.ts.
public struct ActivityItem: Codable, Hashable, Sendable, Identifiable {
    public var tipo: String
    public var actor: String
    public var accion: String
    public var evento: String
    public var hace: String
    public var id: String { "\(actor)-\(accion)-\(evento)-\(hace)" }
}
