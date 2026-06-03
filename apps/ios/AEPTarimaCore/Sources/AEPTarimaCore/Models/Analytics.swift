import Foundation

// Subconjunto del AnalyticsPayload del backend que muestra la app.

public struct AnalyticsTotals: Codable, Hashable, Sendable {
    public var competitions: Int
    public var criticalCompetitions: Int
    public var activeReferees: Int
    public var totalReferees: Int
    public var pendingApprovals: Int
    public var uniqueAssignedReferees: Int
    public var filledSlots: Int
    public var openSlots: Int
}

public struct ZoneActivity: Codable, Hashable, Sendable, Identifiable {
    public var zona: String
    public var name: String
    public var competitions: Int
    public var criticalCompetitions: Int
    public var requiredSlots: Int
    public var filledSlots: Int
    public var uniqueAssignedReferees: Int
    public var activeReferees: Int
    public var crossZoneSlots: Int?
    public var id: String { zona }
}

public struct TopReferee: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var nombre: String
    public var nivel: RefereeLevel
    public var assignedCompetitions: Int
    public var assignedSlots: Int
}

/// Lo que la app consume de GET /analytics.
public struct AnalyticsSummary: Codable, Sendable {
    public var selectedYear: Int
    public var rejectionRate: Double
    public var totals: AnalyticsTotals
    public var activityByZone: [ZoneActivity]
    public var topReferees: [TopReferee]
}
