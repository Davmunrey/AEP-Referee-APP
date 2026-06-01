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
    private(set) var competitions: [Competition] = []
    private(set) var loadState: LoadState = .idle

    init(api: APIClient) { self.api = api }

    func load() async {
        loadState = .loading
        do {
            competitions = try await api.send(.competitions)
            loadState = .loaded
        } catch let error as APIError {
            loadState = .failed(error.userMessage)
        } catch {
            loadState = .failed("Error inesperado.")
        }
    }
}
