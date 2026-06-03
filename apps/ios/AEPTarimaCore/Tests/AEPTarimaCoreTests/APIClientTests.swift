import XCTest
@testable import AEPTarimaCore

/// Stub de red para interceptar las peticiones del APIClient sin tocar la red.
/// Permite encolar respuestas y registrar las peticiones realizadas.
final class StubURLProtocol: URLProtocol {
    struct Stub { let status: Int; let body: Data }

    // Estado de test (acceso de un solo hilo en los tests).
    static var responses: [Stub] = []
    static var requests: [URLRequest] = []

    static func reset() {
        responses = []
        requests = []
    }

    static func enqueue(status: Int, json: String) {
        responses.append(Stub(status: status, body: Data(json.utf8)))
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}

    override func startLoading() {
        Self.requests.append(request)
        let stub = Self.responses.isEmpty
            ? Stub(status: 200, body: Data("{}".utf8))
            : Self.responses.removeFirst()
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: stub.status,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: stub.body)
        client?.urlProtocolDidFinishLoading(self)
    }
}

/// TokenProvider de prueba: controla el token y cuenta los refresh.
final class MockTokens: TokenProvider, @unchecked Sendable {
    var token: String?
    var refreshResult: String?
    private(set) var refreshCount = 0

    init(token: String?, refreshResult: String? = nil) {
        self.token = token
        self.refreshResult = refreshResult
    }

    func accessToken() async -> String? { token }
    func refresh() async -> String? {
        refreshCount += 1
        token = refreshResult
        return refreshResult
    }
}

private struct Probe: Codable, Equatable { let value: String }

final class APIClientTests: XCTestCase {
    private func makeClient(tokens: TokenProvider) -> APIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        return APIClient(
            baseURL: URL(string: "https://example.test/api/v1")!,
            tokens: tokens,
            session: URLSession(configuration: config)
        )
    }

    override func setUp() {
        super.setUp()
        StubURLProtocol.reset()
    }

    func testSuccessDecodesEnvelopeAndSendsBearer() async throws {
        StubURLProtocol.enqueue(status: 200, json: #"{"data":{"value":"ok"}}"#)
        let client = makeClient(tokens: MockTokens(token: "tok-A"))
        let probe: Probe = try await client.send(.init(.get, "/probe"))
        XCTAssertEqual(probe, Probe(value: "ok"))
        let auth = StubURLProtocol.requests.last?.value(forHTTPHeaderField: "Authorization")
        XCTAssertEqual(auth, "Bearer tok-A")
    }

    func test401RefreshesAndRetries() async throws {
        StubURLProtocol.enqueue(status: 401, json: #"{"error":"No autenticado"}"#)
        StubURLProtocol.enqueue(status: 200, json: #"{"data":{"value":"ok"}}"#)
        let tokens = MockTokens(token: "old", refreshResult: "new")
        let client = makeClient(tokens: tokens)

        let probe: Probe = try await client.send(.init(.get, "/probe"))
        XCTAssertEqual(probe, Probe(value: "ok"))
        XCTAssertEqual(tokens.refreshCount, 1)
        // El reintento usa el token refrescado.
        XCTAssertEqual(StubURLProtocol.requests.count, 2)
        XCTAssertEqual(
            StubURLProtocol.requests.last?.value(forHTTPHeaderField: "Authorization"),
            "Bearer new"
        )
    }

    func test401WithFailedRefreshThrowsUnauthorized() async {
        StubURLProtocol.enqueue(status: 401, json: #"{"error":"x"}"#)
        let tokens = MockTokens(token: "old", refreshResult: nil)
        let client = makeClient(tokens: tokens)
        do {
            let _: Probe = try await client.send(.init(.get, "/probe"))
            XCTFail("debería lanzar unauthorized")
        } catch {
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
    }

    func testServerErrorMapsMessage() async {
        StubURLProtocol.enqueue(status: 400, json: #"{"error":"Sin permiso"}"#)
        let client = makeClient(tokens: MockTokens(token: "t"))
        do {
            let _: Probe = try await client.send(.init(.get, "/probe"))
            XCTFail("debería lanzar server error")
        } catch {
            XCTAssertEqual(error as? APIError, .server(status: 400, message: "Sin permiso"))
        }
    }

    func testMalformedBodyThrowsDecoding() async {
        StubURLProtocol.enqueue(status: 200, json: "{not-json")
        let client = makeClient(tokens: MockTokens(token: "t"))
        do {
            let _: Probe = try await client.send(.init(.get, "/probe"))
            XCTFail("debería lanzar decoding")
        } catch let error as APIError {
            if case .decoding = error { /* ok */ } else { XCTFail("esperaba .decoding, fue \(error)") }
        } catch {
            XCTFail("tipo de error inesperado: \(error)")
        }
    }

    func testNoAuthHeaderWhenNotRequired() async throws {
        StubURLProtocol.enqueue(status: 200, json: #"{"data":{"value":"ok"}}"#)
        let client = makeClient(tokens: MockTokens(token: "tok-A"))
        let _: Probe = try await client.send(.init(.get, "/public", requiresAuth: false))
        XCTAssertNil(StubURLProtocol.requests.last?.value(forHTTPHeaderField: "Authorization"))
    }
}
