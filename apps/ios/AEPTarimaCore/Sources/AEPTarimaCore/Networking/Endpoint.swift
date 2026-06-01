import Foundation

public enum HTTPMethod: String, Sendable {
    case get = "GET", post = "POST", patch = "PATCH", delete = "DELETE"
}

/// Descripción de una llamada a /api/v1. El cuerpo se entrega ya codificado
/// para que `Endpoint` no sea genérico y se pueda almacenar/enrutar con soltura.
public struct Endpoint: Sendable {
    public var method: HTTPMethod
    public var path: String              // relativo a /api/v1, p. ej. "/competitions"
    public var query: [URLQueryItem]
    public var body: Data?
    public var requiresAuth: Bool

    public init(
        _ method: HTTPMethod, _ path: String, query: [URLQueryItem] = [],
        body: Data? = nil, requiresAuth: Bool = true
    ) {
        self.method = method; self.path = path; self.query = query
        self.body = body; self.requiresAuth = requiresAuth
    }
}

private let encoder: JSONEncoder = {
    let e = JSONEncoder()
    return e
}()

private func jsonBody<T: Encodable>(_ value: T) -> Data? {
    try? encoder.encode(value)
}

// Fábricas de endpoints, espejo del árbol de rutas en src/app/api/v1.
public extension Endpoint {
    static let me = Endpoint(.get, "/auth/me")
    static let meta = Endpoint(.get, "/meta")
    static let dashboard = Endpoint(.get, "/dashboard")
    static let analytics = Endpoint(.get, "/analytics")
    static let regulations = Endpoint(.get, "/regulations")

    static func referees(zona: String? = nil, q: String? = nil) -> Endpoint {
        var items: [URLQueryItem] = []
        if let zona { items.append(.init(name: "zona", value: zona)) }
        if let q { items.append(.init(name: "q", value: q)) }
        return Endpoint(.get, "/referees", query: items)
    }
    static func referee(_ id: String) -> Endpoint { Endpoint(.get, "/referees/\(id)") }
    static func refereeSanctions(_ id: String) -> Endpoint { Endpoint(.get, "/referees/\(id)/sanctions") }

    static let competitions = Endpoint(.get, "/competitions")
    static func competition(_ id: String) -> Endpoint { Endpoint(.get, "/competitions/\(id)") }
    static func roster(_ competitionId: String) -> Endpoint { Endpoint(.get, "/competitions/\(competitionId)/roster") }

    static func assign(_ competitionId: String, slotKey: String, refereeId: String, crossZoneReason: String? = nil) -> Endpoint {
        struct Body: Encodable { let slotKey: String; let refereeId: String; let crossZoneReason: String? }
        return Endpoint(.post, "/competitions/\(competitionId)/roster/assign",
                        body: jsonBody(Body(slotKey: slotKey, refereeId: refereeId, crossZoneReason: crossZoneReason)))
    }
    static func submitRoster(_ competitionId: String) -> Endpoint {
        Endpoint(.post, "/competitions/\(competitionId)/roster/submit")
    }

    static let approvals = Endpoint(.get, "/approvals")
    static func reviewApproval(_ id: String, approve: Bool, comment: String? = nil) -> Endpoint {
        struct Body: Encodable { let approve: Bool; let comment: String? }
        return Endpoint(.post, "/approvals/\(id)/review", body: jsonBody(Body(approve: approve, comment: comment)))
    }

    static func registerDevice(_ reg: DeviceRegistration) -> Endpoint {
        Endpoint(.post, "/devices", body: jsonBody(reg))
    }
    static func unregisterDevice(token: String) -> Endpoint {
        let escaped = token.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? token
        return Endpoint(.delete, "/devices/\(escaped)")
    }
}
