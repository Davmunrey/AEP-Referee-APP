import Foundation
import Observation
import AEPTarimaCore

@MainActor
@Observable
final class AdminUsersViewModel {
    private let api: APIClient
    private(set) var state: Loadable<[AdminUser]> = .idle
    var isWorking = false
    var errorMessage: String?

    init(api: APIClient) { self.api = api }

    func load() async {
        state = .loading
        do {
            let users: [AdminUser] = try await api.send(.adminUsers)
            state = .loaded(users)
        } catch let error as APIError {
            state = .failed(error.userMessage)
        } catch {
            state = .failed("Error inesperado.")
        }
    }

    func setActive(_ user: AdminUser, _ activo: Bool) async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await api.sendIgnoringBody(.setUserActive(user.id, activo))
            await load()
        } catch let error as APIError {
            errorMessage = error.userMessage
        } catch {
            errorMessage = "No se pudo actualizar."
        }
    }

    func create(_ payload: NewUserPayload) async -> Bool {
        isWorking = true
        defer { isWorking = false }
        do {
            try await api.sendIgnoringBody(.createUser(payload))
            await load()
            return true
        } catch let error as APIError {
            errorMessage = error.userMessage
            return false
        } catch {
            errorMessage = "No se pudo crear el usuario."
            return false
        }
    }
}
