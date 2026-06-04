import Foundation
import Observation
import AEPTarimaCore

@MainActor
@Observable
final class DashboardViewModel {
    private let api: any APIRequesting
    private let cacheKey = "dashboard"
    private(set) var state: Loadable<DashboardSummary> = .idle
    private(set) var isOffline = false

    init(api: any APIRequesting) { self.api = api }

    func load() async {
        state = .loading
        let result = await OfflineLoad.single(cacheKey: cacheKey) {
            let summary: DashboardSummary = try await api.send(.dashboard)
            return summary
        }
        state = result.state
        isOffline = result.offline
    }
}
