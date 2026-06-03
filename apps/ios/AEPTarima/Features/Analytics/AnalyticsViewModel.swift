import Foundation
import Observation
import AEPTarimaCore

@MainActor
@Observable
final class AnalyticsViewModel {
    private let api: APIClient
    private let cacheKey = "analytics"
    private(set) var state: Loadable<AnalyticsSummary> = .idle
    private(set) var isOffline = false

    init(api: APIClient) { self.api = api }

    func load() async {
        state = .loading
        do {
            let summary: AnalyticsSummary = try await api.send(.analytics)
            DiskCache.shared.save(summary, key: cacheKey)
            isOffline = false
            state = .loaded(summary)
        } catch {
            if let cached = DiskCache.shared.load(AnalyticsSummary.self, key: cacheKey) {
                isOffline = true
                state = .loaded(cached)
            } else if let apiError = error as? APIError {
                state = .failed(apiError.userMessage)
            } else {
                state = .failed("Error inesperado.")
            }
        }
    }
}
