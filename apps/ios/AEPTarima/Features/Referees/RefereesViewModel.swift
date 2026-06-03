import Foundation
import Observation
import AEPTarimaCore

@MainActor
@Observable
final class RefereesViewModel {
    private let api: APIClient
    private let cacheKey = "referees"
    private(set) var state: Loadable<[Referee]> = .idle
    /// True cuando los datos mostrados vienen de la caché (sin conexión).
    private(set) var isOffline = false

    init(api: APIClient) { self.api = api }

    func load() async {
        state = .loading
        do {
            let referees: [Referee] = try await api.send(.referees())
            DiskCache.shared.save(referees, key: cacheKey)
            isOffline = false
            state = .loaded(referees)
        } catch let error as APIError {
            // Sin conexión / error: servir caché si la hay.
            if let cached = DiskCache.shared.load([Referee].self, key: cacheKey) {
                isOffline = true
                state = .loaded(cached)
            } else {
                state = .failed(error.userMessage)
            }
        } catch {
            if let cached = DiskCache.shared.load([Referee].self, key: cacheKey) {
                isOffline = true
                state = .loaded(cached)
            } else {
                state = .failed("Error inesperado.")
            }
        }
    }

    /// Crea un juez y recarga la lista. Devuelve true si tuvo éxito.
    func create(_ payload: NewRefereePayload) async -> Bool {
        do {
            try await api.sendIgnoringBody(.createReferee(payload))
            await load()
            return true
        } catch {
            return false
        }
    }

    func filtered(_ query: String) -> [Referee] {
        guard case let .loaded(referees) = state else { return [] }
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return referees }
        return referees.filter {
            $0.nombre.lowercased().contains(q)
                || $0.zona.lowercased().contains(q)
                || ($0.localidad?.lowercased().contains(q) ?? false)
        }
    }
}
