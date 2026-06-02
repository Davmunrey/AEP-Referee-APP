import Foundation

/// Regla de normativa IPF (requisitos por rol y tipo de evento).
/// Espeja `RegulationRule` de src/lib/types.ts.
public struct RegulationRule: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var rol: String
    public var roleKey: String
    public var minLevel: RefereeLevel
    public var eventTypes: [EventType]
    public var note: String
}
