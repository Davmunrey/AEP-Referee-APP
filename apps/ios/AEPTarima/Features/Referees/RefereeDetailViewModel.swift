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
    var isWorking = false
    var errorMessage: String?

    init(api: APIClient, refereeId: String) {
        self.api = api
        self.refereeId = refereeId
    }

    /// Edita la ficha del juez (PATCH). Devuelve el juez actualizado o nil.
    func updateReferee(_ patch: RefereePatch) async -> Referee? {
        isWorking = true
        defer { isWorking = false }
        do {
            let updated: Referee = try await api.send(.updateReferee(refereeId, patch))
            return updated
        } catch let error as APIError {
            errorMessage = error.userMessage
            return nil
        } catch {
            errorMessage = "No se pudo guardar."
            return nil
        }
    }

    func createExam(_ payload: NewExamPayload) async -> Bool {
        await mutate {
            let _: RefereeExam = try await self.api.send(.createExam(payload))
        }
    }

    func createReport(_ payload: NewReportPayload) async -> Bool {
        await mutate {
            let _: RefereeReport = try await self.api.send(.createReport(payload))
        }
    }

    func createSanction(_ payload: NewSanctionPayload) async -> Bool {
        await mutate {
            let _: RefereeSanction = try await self.api.send(.createSanction(self.refereeId, payload))
        }
    }

    func revokeSanction(_ sanctionId: String, motivo: String) async -> Bool {
        await mutate {
            try await self.api.sendIgnoringBody(.revokeSanction(sanctionId, motivo: motivo))
        }
    }

    /// Ejecuta una mutación y recarga el detalle; gestiona working/errores.
    private func mutate(_ action: () async throws -> Void) async -> Bool {
        isWorking = true
        defer { isWorking = false }
        do {
            try await action()
            await load()
            return true
        } catch let error as APIError {
            errorMessage = error.userMessage
            return false
        } catch {
            errorMessage = "No se pudo completar la operación."
            return false
        }
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
