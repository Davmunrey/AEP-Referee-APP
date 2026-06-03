import XCTest
@testable import AEPTarimaCore

/// Decodifican subconjuntos de los payloads de Dashboard y Analítica, ignorando
/// las claves no declaradas (activity, calendar, yearlyHistory, etc.).
final class DashboardAnalyticsTests: XCTestCase {
    private let decoder = JSONDecoder()

    func testDashboardSummaryDecodesIgnoringExtraKeys() throws {
        let json = """
        {
          "kpis": [{"label":"Cobertura","value":"92%","sub":"nacional","trend":"+3","trendDir":"up","accent":"blue"}],
          "activity": [{"tipo":"x","actor":"a","accion":"b","evento":"c","hace":"ahora"}],
          "calendar": {},
          "upcomingCompetitions": [],
          "health": {"score":81,"status":"estable","summary":"ok","factors":[{"label":"Cobertura","score":0.9,"weight":0.5,"detail":"d"}]},
          "insights": [{"id":"i1","severity":"alerta","title":"t","detail":"d"}],
          "coverage": [{"id":"c1","nombre":"Open","fecha":"2026-06-01","estado":"Incompleto","filled":8,"open":2,"required":10}]
        }
        """.data(using: .utf8)!
        let dash = try decoder.decode(DashboardSummary.self, from: json)
        XCTAssertEqual(dash.kpis.first?.accent, "blue")
        XCTAssertEqual(dash.health.factors.first?.weight, 0.5)
        XCTAssertEqual(dash.coverage.first?.requiredSlots, 10)
        XCTAssertEqual(dash.coverage.first?.estado, .incompleto)
    }

    func testAnalyticsSummaryDecodes() throws {
        let json = """
        {
          "availableYears":[2025,2026], "selectedYear":2026, "yearlyHistory":[],
          "activityByZone":[{"zona":"CENTRO","name":"Centro","competitions":4,"criticalCompetitions":1,"requiredSlots":40,"filledSlots":36,"uniqueAssignedReferees":12,"activeReferees":15}],
          "topReferees":[{"id":"j1","nombre":"Ana","nivel":"Nacional","assignedCompetitions":5,"assignedSlots":20}],
          "rejectionRate":0.08, "criticalEvents":[],
          "totals":{"competitions":10,"criticalCompetitions":2,"activeReferees":30,"totalReferees":40,"pendingApprovals":3,"uniqueAssignedReferees":25,"filledSlots":120,"openSlots":12}
        }
        """.data(using: .utf8)!
        let analytics = try decoder.decode(AnalyticsSummary.self, from: json)
        XCTAssertEqual(analytics.selectedYear, 2026)
        XCTAssertEqual(analytics.totals.competitions, 10)
        XCTAssertEqual(analytics.activityByZone.first?.name, "Centro")
        XCTAssertEqual(analytics.topReferees.first?.nivel, .nacional)
    }
}
