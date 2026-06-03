import Foundation

// Subconjunto del DashboardPayload del backend (src/lib/types.ts) que muestra la
// app. Codable ignora las claves no declaradas (activity, calendar, etc.).

public struct DashboardKpi: Codable, Hashable, Sendable, Identifiable {
    public var label: String
    public var value: String
    public var sub: String
    public var trend: String
    public var trendDir: String   // up | down | warn | flat
    public var accent: String     // red | yellow | blue | neutral
    public var id: String { label }
}

public struct HealthFactor: Codable, Hashable, Sendable, Identifiable {
    public var label: String
    public var score: Double
    public var weight: Double
    public var detail: String
    public var id: String { label }
}

public struct OperationalHealth: Codable, Hashable, Sendable {
    public var score: Double
    public var status: String
    public var summary: String
    public var factors: [HealthFactor]
    public var delta: Double?
    public var previousScore: Double?
}

public struct Insight: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var severity: String   // crítico | alerta | sugerencia | ok
    public var title: String
    public var detail: String
    public var metric: String?
}

public struct EventCoverage: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var nombre: String
    public var fecha: String
    public var estado: EventStatus
    public var filled: Int
    public var open: Int
    public var requiredSlots: Int

    enum CodingKeys: String, CodingKey {
        case id, nombre, fecha, estado, filled, open
        case requiredSlots = "required"
    }
}

/// Lo que la app consume de GET /dashboard.
public struct DashboardSummary: Codable, Sendable {
    public var kpis: [DashboardKpi]
    public var health: OperationalHealth
    public var insights: [Insight]
    public var coverage: [EventCoverage]
    /// Opcionales y tolerantes: si faltan en el payload, quedan nil.
    public var activity: [ActivityItem]?
    public var upcomingCompetitions: [Competition]?
}
