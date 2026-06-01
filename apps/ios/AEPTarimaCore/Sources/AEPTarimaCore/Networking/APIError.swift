import Foundation

/// Errores de la capa de red, mapeados desde las respuestas del backend.
public enum APIError: Error, Equatable, Sendable {
    /// 401: sesión inválida/expirada tras intentar refrescar.
    case unauthorized
    /// El backend devolvió `{ error, details }` con un status >= 400.
    case server(status: Int, message: String)
    /// Respuesta no decodificable o status inesperado.
    case decoding(String)
    /// Fallo de transporte (sin red, timeout, etc.).
    case transport(String)

    public var userMessage: String {
        switch self {
        case .unauthorized: return "Tu sesión ha caducado. Vuelve a iniciar sesión."
        case let .server(_, message): return message
        case .decoding: return "Respuesta inesperada del servidor."
        case let .transport(message): return message
        }
    }
}
