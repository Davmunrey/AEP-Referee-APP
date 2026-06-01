import Foundation

/// Propuesta de tarima enviada a aprobación. Espeja `ApprovalProposal`.
public struct ApprovalProposal: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var competitionId: String
    public var competitionName: String
    public var zona: String
    public var submittedBy: String
    /// UUID (profiles.id) del remitente, si se conoce (migración 022).
    public var submittedById: String?
    public var submittedAt: String
    public var status: ApprovalStatus
    public var assignments: AssignmentsMap
    public var comment: String?
    public var reviewedBy: String?
    public var reviewedById: String?
    public var reviewedAt: String?
}
