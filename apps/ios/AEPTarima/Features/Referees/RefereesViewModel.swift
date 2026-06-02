import Foundation
import Observation
import AEPTarimaCore

@MainActor
@Observable
final class RefereesViewModel {
    private let api: APIClient
    private(set) var state: Loadable<[Referee]> = .idle

    init(api: APIClient) { self.api = api }

    func load() async {
        state = .loading
        do {
            let referees: [Referee] = try await api.send(.referees())
            state = .loaded(referees)
        } catch let error as APIError {
            state = .failed(error.userMessage)
        } catch {
            state = .failed("Error inesperado.")
        }
    }

    /// Filtra la lista cargada por nombre/zona/localidad (búsqueda local).
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
