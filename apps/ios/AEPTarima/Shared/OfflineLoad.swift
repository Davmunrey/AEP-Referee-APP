import Foundation
import AEPTarimaCore

/// Patrón reutilizable de carga con caché offline: intenta la red y, si falla,
/// sirve la última copia en disco marcándola como offline; si no hay caché,
/// devuelve el error. Centraliza la lógica repetida en los view models.
@MainActor
enum OfflineLoad {
    static func list<T: Codable>(
        cacheKey: String,
        fetch: () async throws -> [T]
    ) async -> (state: Loadable<[T]>, offline: Bool) {
        do {
            let items = try await fetch()
            DiskCache.shared.save(items, key: cacheKey)
            return (.loaded(items), false)
        } catch {
            if let cached = DiskCache.shared.load([T].self, key: cacheKey) {
                return (.loaded(cached), true)
            }
            return (.failed(message(for: error)), false)
        }
    }

    static func single<T: Codable>(
        cacheKey: String,
        fetch: () async throws -> T
    ) async -> (state: Loadable<T>, offline: Bool) {
        do {
            let value = try await fetch()
            DiskCache.shared.save(value, key: cacheKey)
            return (.loaded(value), false)
        } catch {
            if let cached = DiskCache.shared.load(T.self, key: cacheKey) {
                return (.loaded(cached), true)
            }
            return (.failed(message(for: error)), false)
        }
    }

    private static func message(for error: Error) -> String {
        (error as? APIError)?.userMessage ?? "Error inesperado."
    }
}
