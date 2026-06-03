import Foundation
import Observation
import AEPTarimaCore

@MainActor
@Observable
final class DashboardViewModel {
    private let api: APIClient
    private let cacheKey = "dashboard"
    private(set) var state: Loadable<DashboardSummary> = .idle
    private(set) var isOffline = false

    init(api: APIClient) { self.api = api }

    func load() async {
        state = .loading
        do {
            let summary: DashboardSummary = try await api.send(.dashboard)
            DiskCache.shared.save(summary, key: cacheKey)
            isOffline = false
            state = .loaded(summary)
        } catch {
            if let cached = DiskCache.shared.load(DashboardSummary.self, key: cacheKey) {
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
