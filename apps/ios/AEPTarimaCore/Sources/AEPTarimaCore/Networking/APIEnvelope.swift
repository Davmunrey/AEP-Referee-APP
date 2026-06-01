import Foundation

/// Respuesta de éxito del backend: `{ "data": T }` (ver src/lib/api/route-utils).
public struct APISuccess<T: Decodable>: Decodable {
    public let data: T
}

/// Respuesta de error del backend: `{ "error": string, "details"?: unknown }`.
public struct APIErrorBody: Decodable {
    public let error: String
}
