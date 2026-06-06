import Foundation
import Observation
import AEPTarimaCore

/// Edita la plantilla de tarima (sesiones, roles y plazas) desde el móvil y la
/// guarda vía `PUT /roster/template` — el mismo servicio que el editor web.
@MainActor
@Observable
final class TemplateEditorViewModel: Identifiable {
    nonisolated let id = UUID()
    private let api: APIClient
    let competition: Competition

    /// Copia de trabajo editable. Se renumeran los ids de sesión al guardar.
    var sessions: [RosterSession]
    var isSaving = false
    var errorMessage: String?

    init(api: APIClient, competition: Competition, initial: [RosterSession]) {
        self.api = api
        self.competition = competition
        self.sessions = initial.isEmpty
            ? [RosterTemplateKit.blankSession(number: 1, tipo: competition.tipo)]
            : initial
    }

    // MARK: - Sesiones

    func addSession() {
        let next = sessions.count + 1
        sessions.append(RosterTemplateKit.blankSession(number: next, tipo: competition.tipo))
    }

    func removeSessions(at offsets: IndexSet) {
        sessions.remove(atOffsets: offsets)
        if sessions.isEmpty {
            sessions = [RosterTemplateKit.blankSession(number: 1, tipo: competition.tipo)]
        }
    }

    // MARK: - Roles dentro de una sesión

    /// Ajusta las plazas de un rol; 0 lo deja sin plazas (no genera columnas).
    func setSlots(_ slots: Int, roleKey: String, inSession index: Int, pesaje: Bool) {
        guard sessions.indices.contains(index) else { return }
        let clamped = max(0, min(slots, 9))
        if pesaje {
            updateRole(in: &sessions[index].pesajeRoles, key: roleKey) { $0.slots = clamped }
        } else {
            updateRole(in: &sessions[index].roles, key: roleKey) { $0.slots = clamped }
        }
    }

    /// Claves de rol que aún no están en la sesión (para el menú "Añadir rol").
    func availableRoleTypes(forSession index: Int, pesaje: Bool) -> [RosterTemplateKit.RoleType] {
        guard sessions.indices.contains(index) else { return [] }
        let present = Set((pesaje ? sessions[index].pesajeRoles : sessions[index].roles).map(\.key))
        return RosterTemplateKit.roleCatalog.filter { !present.contains($0.key) }
    }

    func addRole(_ type: RosterTemplateKit.RoleType, toSession index: Int, pesaje: Bool) {
        guard sessions.indices.contains(index) else { return }
        let role = RosterRole(rol: type.label, slots: 1, key: type.key)
        if pesaje { sessions[index].pesajeRoles.append(role) }
        else { sessions[index].roles.append(role) }
    }

    func removeRole(key: String, fromSession index: Int, pesaje: Bool) {
        guard sessions.indices.contains(index) else { return }
        if pesaje { sessions[index].pesajeRoles.removeAll { $0.key == key } }
        else { sessions[index].roles.removeAll { $0.key == key } }
    }

    // MARK: - Validación + guardado

    /// Total de plazas de toda la plantilla (para mostrar al usuario).
    var totalSlots: Int {
        sessions.reduce(0) { acc, s in
            acc + s.roles.reduce(0) { $0 + max($1.slots, 0) }
                + s.pesajeRoles.reduce(0) { $0 + max($1.slots, 0) }
        }
    }

    /// La plantilla es válida si al menos una plaza existe en total.
    var isValid: Bool { totalSlots > 0 }

    func save() async -> Bool {
        guard isValid else {
            errorMessage = "Añade al menos una plaza antes de guardar."
            return false
        }
        isSaving = true
        defer { isSaving = false }
        let payload = RosterTemplateKit.renumber(sessions)
        do {
            try await api.sendIgnoringBody(.saveTemplate(competition.id, template: payload))
            return true
        } catch let error as APIError {
            errorMessage = error.userMessage
            return false
        } catch {
            errorMessage = "No se pudo guardar la plantilla."
            return false
        }
    }

    private func updateRole(
        in roles: inout [RosterRole], key: String, _ mutate: (inout RosterRole) -> Void
    ) {
        guard let i = roles.firstIndex(where: { $0.key == key }) else { return }
        mutate(&roles[i])
    }
}
