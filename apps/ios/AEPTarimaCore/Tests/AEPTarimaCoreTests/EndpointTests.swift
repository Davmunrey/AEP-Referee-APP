import XCTest
@testable import AEPTarimaCore

/// Comprueba que las fábricas de endpoints construyen método, ruta, query y
/// cuerpo correctos (espejo del árbol /api/v1).
final class EndpointTests: XCTestCase {
    func testSimpleEndpoints() {
        XCTAssertEqual(Endpoint.me.path, "/auth/me")
        XCTAssertEqual(Endpoint.me.method, .get)
        XCTAssertTrue(Endpoint.me.requiresAuth)
    }

    func testRefereesQueryItems() {
        let ep = Endpoint.referees(zona: "CENTRO", q: "ana")
        XCTAssertEqual(ep.path, "/referees")
        XCTAssertTrue(ep.query.contains(URLQueryItem(name: "zona", value: "CENTRO")))
        XCTAssertTrue(ep.query.contains(URLQueryItem(name: "q", value: "ana")))
    }

    func testAssignEncodesBody() throws {
        let ep = Endpoint.assign("c1", slotKey: "s1_central_0", refereeId: "j001")
        XCTAssertEqual(ep.method, .post)
        XCTAssertEqual(ep.path, "/competitions/c1/roster/assign")
        let body = try XCTUnwrap(ep.body)
        let obj = try JSONSerialization.jsonObject(with: body) as? [String: Any]
        XCTAssertEqual(obj?["slotKey"] as? String, "s1_central_0")
        XCTAssertEqual(obj?["refereeId"] as? String, "j001")
    }

    func testUnregisterDeviceEscapesToken() {
        let ep = Endpoint.unregisterDevice(token: "tok+123")
        XCTAssertEqual(ep.method, .delete)
        XCTAssertFalse(ep.path.contains("+"), "el token debe ir percent-encoded")
    }
}
