import Foundation

/// Abstracción de la capa de red para desacoplar los view models del cliente
/// concreto y permitir mocks en tests. `APIClient` la conforma.
public protocol APIRequesting: Sendable {
    func send<T: Decodable & Sendable>(_ endpoint: Endpoint, as type: T.Type) async throws -> T
    @discardableResult
    func sendIgnoringBody(_ endpoint: Endpoint) async throws -> Bool
}

public extension APIRequesting {
    /// Azúcar para inferir el tipo del contexto: `let x: T = try await api.send(ep)`.
    func send<T: Decodable & Sendable>(_ endpoint: Endpoint) async throws -> T {
        try await send(endpoint, as: T.self)
    }
}
