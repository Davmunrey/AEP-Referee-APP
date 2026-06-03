import Foundation
import Observation
import AEPTarimaCore

@MainActor
@Observable
final class RegulationsViewModel {
    private let api: APIClient
    private let cacheKey = "regulations"
    private(set) var state: Loadable<[RegulationRule]> = .idle
    private(set) var isOffline = false

    init(api: APIClient) { self.api = api }

    func load() async {
        state = .loading
        do {
            let rules: [RegulationRule] = try await api.send(.regulations)
            DiskCache.shared.save(rules, key: cacheKey)
            isOffline = false
            state = .loaded(rules)
        } catch {
            if let cached = DiskCache.shared.load([RegulationRule].self, key: cacheKey) {
                isOffline = true
                state = .loaded(cached)
            } else if let apiError = error as? APIError {
                state = .failed(apiError.userMessage)
            } else {
                state = .failed("Error inesperado.")
            }
        }
    }

    func filtered(_ query: String) -> [RegulationRule] {
        guard case let .loaded(rules) = state else { return [] }
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return rules }
        return rules.filter {
            $0.rol.lowercased().contains(q) || $0.note.lowercased().contains(q)
        }
    }
}
