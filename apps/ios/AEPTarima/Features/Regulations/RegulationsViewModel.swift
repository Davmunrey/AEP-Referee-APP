import Foundation
import Observation
import AEPTarimaCore

@MainActor
@Observable
final class RegulationsViewModel {
    private let api: any APIRequesting
    private let cacheKey = "regulations"
    private(set) var state: Loadable<[RegulationRule]> = .idle
    private(set) var isOffline = false

    init(api: any APIRequesting) { self.api = api }

    func load() async {
        state = .loading
        let result = await OfflineLoad.list(cacheKey: cacheKey) {
            let rules: [RegulationRule] = try await api.send(.regulations)
            return rules
        }
        state = result.state
        isOffline = result.offline
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
