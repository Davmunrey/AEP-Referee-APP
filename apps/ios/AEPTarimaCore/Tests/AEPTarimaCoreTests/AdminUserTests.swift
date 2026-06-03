import XCTest
@testable import AEPTarimaCore

final class AdminUserTests: XCTestCase {
    private let decoder = JSONDecoder()

    func testAdminUserDecodesSnakeCase() throws {
        let json = """
        { "id":"u1","email":"ana@aep.es","nombre":"Ana","rol_label":"Delegado de Zona",
          "iniciales":"AN","role":"delegado_zona","zona":"CENTRO","activo":true,
          "created_at":"2026-01-01T00:00:00Z" }
        """.data(using: .utf8)!
        let user = try decoder.decode(AdminUser.self, from: json)
        XCTAssertEqual(user.rolLabel, "Delegado de Zona")
        XCTAssertEqual(user.role, .delegadoZona)
        XCTAssertTrue(user.activo)
        XCTAssertEqual(user.zona, "CENTRO")
    }

    func testAdminUserListEnvelope() throws {
        let json = #"{ "data": [ { "id":"u1","email":"a@b.c","nombre":"A","rol_label":"X","iniciales":"A","role":"solo_ver","activo":false } ] }"#.data(using: .utf8)!
        let users = try decoder.decode(APISuccess<[AdminUser]>.self, from: json).data
        XCTAssertEqual(users.count, 1)
        XCTAssertEqual(users.first?.role, .soloVer)
        XCTAssertNil(users.first?.zona)
    }
}
