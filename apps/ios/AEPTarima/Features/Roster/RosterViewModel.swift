import Foundation
import Observation
import AEPTarimaCore

/// Una plaza concreta de la tarima (sesión + rol + índice). El `key` coincide
/// con el del backend: "<sesion>_<roleKey>_<i>" (ver lib/roster-template.ts).
struct RosterSlot: Identifiable, Hashable {
    let key: String
    let roleName: String
    let index: Int
    var id: String { key }
}

@MainActor
@Observable
final class RosterViewModel {
    private let api: APIClient
    let competition: Competition
    private(set) var state: Loadable<RosterPayload> = .idle
    private(set) var referees: [Referee] = []
    private var refereesById: [String: Referee] = [:]
    var isWorking = false
    var errorMessage: String?

    init(api: APIClient, competition: Competition) {
        self.api = api
        self.competition = competition
    }

    func load() async {
        state = .loading
        do {
            async let rosterCall: RosterPayload = api.send(.roster(competition.id))
            async let refsCall: [Referee] = api.send(.referees())
            let roster = try await rosterCall
            let refs = try await refsCall
            referees = refs
            refereesById = Dictionary(refs.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
            state = .loaded(roster)
        } catch let error as APIError {
            state = .failed(error.userMessage)
        } catch {
            state = .failed("Error inesperado.")
        }
    }

    /// Plazas de una sesión (roles de competición + pesaje), con su slot key.
    func slots(for session: RosterSession) -> [RosterSlot] {
        var result: [RosterSlot] = []
        for role in session.roles + session.pesajeRoles {
            for i in 0..<max(role.slots, 0) {
                result.append(RosterSlot(
                    key: "\(session.sesion)_\(role.key)_\(i)",
                    roleName: role.rol,
                    index: i
                ))
            }
        }
        return result
    }

    func assignedReferee(forSlot key: String) -> Referee? {
        guard case let .loaded(payload) = state else { return nil }
        guard let refereeId = payload.assignments[key] ?? nil else { return nil }
        return refereesById[refereeId]
    }

    func assign(slotKey: String, refereeId: String) async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await api.sendIgnoringBody(.assign(competition.id, slotKey: slotKey, refereeId: refereeId))
            await load()
        } catch let error as APIError {
            errorMessage = error.userMessage
        } catch {
            errorMessage = "No se pudo asignar."
        }
    }

    func clearSlot(_ slotKey: String) async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await api.sendIgnoringBody(.clearSlot(competition.id, slotKey: slotKey))
            await load()
        } catch let error as APIError {
            errorMessage = error.userMessage
        } catch {
            errorMessage = "No se pudo quitar la asignación."
        }
    }

    func submit() async -> Bool {
        isWorking = true
        defer { isWorking = false }
        do {
            try await api.sendIgnoringBody(.submitRoster(competition.id))
            return true
        } catch let error as APIError {
            errorMessage = error.userMessage
            return false
        } catch {
            errorMessage = "No se pudo enviar."
            return false
        }
    }

    /// Plantilla actualmente cargada (o vacía si aún no hay tarima configurada).
    var currentTemplate: [RosterSession] {
        if case let .loaded(payload) = state { return payload.template }
        return []
    }

    /// Crea el editor de plantilla sembrado con la plantilla actual (o en blanco).
    func makeTemplateEditor() -> TemplateEditorViewModel {
        TemplateEditorViewModel(api: api, competition: competition, initial: currentTemplate)
    }

    /// Genera la plantilla AEP estándar para el tipo de la competición y recarga.
    /// Permite configurar la tarima desde el móvil cuando aún no tiene plazas.
    func applyPreset() async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await api.sendIgnoringBody(.applyTemplatePreset(competition.id))
            await load()
        } catch let error as APIError {
            errorMessage = error.userMessage
        } catch {
            errorMessage = "No se pudo generar la plantilla."
        }
    }
}
