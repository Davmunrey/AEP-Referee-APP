import Foundation
import Observation
import AEPTarimaCore

@MainActor
@Observable
final class CompetitionDetailViewModel {
    private let api: APIClient
    private(set) var competition: Competition
    private(set) var referees: [Referee] = []
    var isWorking = false
    var errorMessage: String?

    init(api: APIClient, competition: Competition) {
        self.api = api
        self.competition = competition
    }

    func loadReferees() async {
        if !referees.isEmpty { return }
        referees = (try? await api.send(.referees())) ?? []
    }

    func update(_ patch: CompetitionPatch) async -> Bool {
        isWorking = true
        defer { isWorking = false }
        do {
            competition = try await api.send(.updateCompetition(competition.id, patch))
            return true
        } catch let error as APIError {
            errorMessage = error.userMessage
            return false
        } catch {
            errorMessage = "No se pudo guardar."
            return false
        }
    }

    func confirmAvailability(_ refereeId: String) async {
        do {
            try await api.sendIgnoringBody(.addAvailability(competition.id, refereeId: refereeId))
        } catch let error as APIError {
            errorMessage = error.userMessage
        } catch {
            errorMessage = "No se pudo confirmar la disponibilidad."
        }
    }
}
