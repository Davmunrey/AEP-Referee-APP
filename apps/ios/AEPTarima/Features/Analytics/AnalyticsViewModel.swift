import Foundation
import Observation
import AEPTarimaCore

@MainActor
@Observable
final class AnalyticsViewModel {
    private let api: any APIRequesting
    private let cacheKey = "analytics"
    private(set) var state: Loadable<AnalyticsSummary> = .idle
    private(set) var isOffline = false

    init(api: any APIRequesting) { self.api = api }

    func load() async {
        state = .loading
        let result = await OfflineLoad.single(cacheKey: cacheKey) {
            let summary: AnalyticsSummary = try await api.send(.analytics)
            return summary
        }
        state = result.state
        isOffline = result.offline
    }
}
