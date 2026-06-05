import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Cliente de la API REST de AEP Tarima (/api/v1).
///
/// - Inyecta `Authorization: Bearer <jwt>` mediante el `TokenProvider`.
/// - Ante un 401, intenta UN refresh de sesión y reintenta una vez.
/// - Decodifica el envelope `{ data: T }` del backend y mapea `{ error }`.
///
/// Es un `actor` para serializar el acceso y ser seguro frente a concurrencia.
public actor APIClient: APIRequesting {
    private let baseURL: URL          // p. ej. https://aep-tarima.vercel.app/api/v1
    private let tokens: TokenProvider
    private let session: URLSession
    private let decoder: JSONDecoder

    public init(baseURL: URL, tokens: TokenProvider, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.tokens = tokens
        self.session = session
        self.decoder = JSONDecoder()
    }

    /// Ejecuta el endpoint y decodifica la carga `data` como `T`.
    public func send<T: Decodable & Sendable>(_ endpoint: Endpoint, as type: T.Type = T.self) async throws -> T {
        var token = endpoint.requiresAuth ? await tokens.accessToken() : nil
        var (data, response) = try await perform(endpoint, token: token)

        // Reintento único tras refrescar si el backend responde 401.
        if response.statusCode == 401, endpoint.requiresAuth {
            token = await tokens.refresh()
            guard token != nil else { throw APIError.unauthorized }
            (data, response) = try await perform(endpoint, token: token)
            if response.statusCode == 401 { throw APIError.unauthorized }
        }

        guard (200..<300).contains(response.statusCode) else {
            let message = (try? decoder.decode(APIErrorBody.self, from: data))?.error
                ?? "Error \(response.statusCode)"
            throw APIError.server(status: response.statusCode, message: message)
        }

        do {
            return try decoder.decode(APISuccess<T>.self, from: data).data
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }

    /// Variante para endpoints cuya respuesta no interesa (p. ej. registrar token).
    @discardableResult
    public func sendIgnoringBody(_ endpoint: Endpoint) async throws -> Bool {
        struct Ack: Decodable {}
        _ = try await send(endpoint, as: Ack.self)
        return true
    }

    private func perform(_ endpoint: Endpoint, token: String?) async throws -> (Data, HTTPURLResponse) {
        var components = URLComponents(
            url: baseURL.appendingPathComponent(String(endpoint.path.dropFirst())),
            resolvingAgainstBaseURL: false
        )
        if !endpoint.query.isEmpty { components?.queryItems = endpoint.query }
        guard let url = components?.url else { throw APIError.transport("URL inválida") }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.httpBody = endpoint.body
        if endpoint.body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.transport("Respuesta no HTTP")
            }
            return (data, http)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
    }
}
