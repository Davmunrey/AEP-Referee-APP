import Foundation
import Observation
import AEPTarimaCore

@MainActor
@Observable
final class HomeViewModel {
    enum LoadState: Equatable {
        case idle, loading, loaded, failed(String)
    }

    private let api: APIClient
    private let cacheKey = "competitions"
    private(set) var competitions: [Competition] = []
    private(set) var loadState: LoadState = .idle
    private(set) var isOffline = false

    init(api: APIClient) { self.api = api }

    func load() async {
        loadState = .loading
        do {
            let comps: [Competition] = try await api.send(.competitions)
            DiskCache.shared.save(comps, key: cacheKey)
            competitions = comps
            isOffline = false
            loadState = .loaded
        } catch {
            // Sin conexión / error: servir caché si la hay.
            if let cached = DiskCache.shared.load([Competition].self, key: cacheKey) {
                competitions = cached
                isOffline = true
                loadState = .loaded
            } else if let apiError = error as? APIError {
                loadState = .failed(apiError.userMessage)
            } else {
                loadState = .failed("Error inesperado.")
            }
        }
    }
}
