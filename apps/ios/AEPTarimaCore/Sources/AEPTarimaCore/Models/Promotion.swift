import Foundation

/// Solicitud de ascenso de nivel. Espeja `PromotionRequest` de types.ts.
public struct PromotionRequest: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var refereeId: String
    public var refereeName: String
    public var fromLevel: RefereeLevel
    public var toLevel: RefereeLevel
    public var zona: String
    public var status: ApprovalStatus
    public var submittedAt: String
    public var eventosCompletados: Int
    public var motivo: String?
}
