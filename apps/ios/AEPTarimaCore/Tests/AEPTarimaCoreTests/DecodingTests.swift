import XCTest
@testable import AEPTarimaCore

/// Verifica que los modelos decodifican el JSON real del backend (envelope
/// `{ data: ... }`) y que los enums toleran valores desconocidos sin romper.
final class DecodingTests: XCTestCase {
    private let decoder = JSONDecoder()

    func testSessionUserDecodesFromMeEnvelope() throws {
        let json = """
        { "data": { "id": "u1", "nombre": "Ana Juez", "rol": "Delegado de Zona",
          "iniciales": "AJ", "email": "ana@aep.es", "role": "delegado_zona", "zona": "CENTRO" } }
        """.data(using: .utf8)!
        let user = try decoder.decode(APISuccess<SessionUser>.self, from: json).data
        XCTAssertEqual(user.id, "u1")
        XCTAssertEqual(user.role, .delegadoZona)
        XCTAssertTrue(user.role.canEdit)
        XCTAssertFalse(user.role.canApprove)
    }

    func testRefereeDecodesWithOptionalUserId() throws {
        let json = """
        { "id": "j001", "nombre": "Ana", "zona": "CENTRO", "nivel": "Nacional",
          "estado": "Activo", "eventos": 3, "ultimo": "—", "disp": true,
          "iniciales": "AN", "userId": "u-123" }
        """.data(using: .utf8)!
        let r = try decoder.decode(Referee.self, from: json)
        XCTAssertEqual(r.userId, "u-123")
        XCTAssertEqual(r.nivel, .nacional)
        XCTAssertNil(r.email)
    }

    func testCompetitionAndRosterDecode() throws {
        let json = """
        { "template": [ { "sesion": "Sesión 1", "nombre": "Hombres -66kg",
          "dia": "Viernes", "categorias": [{"genero":"Hombres","pesos":"-66kg"}],
          "horarioCompeticion": "09:00", "horarioPesaje": "08:00",
          "roles": [{"rol":"Central","slots":1,"key":"central"}], "pesajeRoles": [] } ],
          "assignments": { "s1_central_0": "j001", "s1_lateral_0": null } }
        """.data(using: .utf8)!
        let roster = try decoder.decode(RosterPayload.self, from: json)
        XCTAssertEqual(roster.template.first?.roles.first?.key, "central")
        XCTAssertEqual(roster.assignments["s1_central_0"], "j001")
        XCTAssertNil(roster.assignments["s1_lateral_0"] ?? nil)
    }

    func testUnknownEnumValueDoesNotThrow() throws {
        let json = #"{ "data": "futuro_rol" }"#.data(using: .utf8)!
        let role = try decoder.decode(APISuccess<UserRole>.self, from: json).data
        XCTAssertEqual(role, .unknown)
        XCTAssertFalse(role.canEdit)
    }

    func testApprovalDecodesWithSubmitterId() throws {
        let json = """
        { "id": "apr-1", "competitionId": "c1", "competitionName": "Open",
          "zona": "CENTRO", "submittedBy": "Ana", "submittedById": "u-sub",
          "submittedAt": "2026-06-01T10:00:00Z", "status": "pendiente", "assignments": {} }
        """.data(using: .utf8)!
        let p = try decoder.decode(ApprovalProposal.self, from: json)
        XCTAssertEqual(p.submittedById, "u-sub")
        XCTAssertEqual(p.status, .pendiente)
        XCTAssertNil(p.reviewedById)
    }
}
