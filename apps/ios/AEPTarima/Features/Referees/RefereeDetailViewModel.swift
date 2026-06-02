import Foundation
import Observation
import AEPTarimaCore

@MainActor
@Observable
final class RefereeDetailViewModel {
    struct Detail {
        var sanctions: [RefereeSanction]
        var exams: [RefereeExam]
        var reports: [RefereeReport]
    }

    private let api: APIClient
    let refereeId: String
    private(set) var state: Loadable<Detail> = .idle

    init(api: APIClient, refereeId: String) {
        self.api = api
        self.refereeId = refereeId
    }

    func load() async {
        state = .loading
        do {
            // Tres lecturas en paralelo.
            async let sanctions: [RefereeSanction] = api.send(.refereeSanctions(refereeId))
            async let exams: [RefereeExam] = api.send(.exams(refereeId: refereeId))
            async let reports: [RefereeReport] = api.send(.reports(refereeId: refereeId))
            state = .loaded(Detail(
                sanctions: try await sanctions,
                exams: try await exams,
                reports: try await reports
            ))
        } catch let error as APIError {
            state = .failed(error.userMessage)
        } catch {
            state = .failed("Error inesperado.")
        }
    }
}
