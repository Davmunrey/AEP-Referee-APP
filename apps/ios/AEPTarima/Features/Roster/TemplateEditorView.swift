import SwiftUI
import AEPTarimaCore

/// Editor de plantilla de tarima: añade/edita sesiones y ajusta las plazas por
/// rol, luego guarda en el backend. Permite configurar competiciones a medida
/// desde el móvil (no solo el preset estándar).
struct TemplateEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @State var model: TemplateEditorViewModel
    /// Se llama tras guardar con éxito para que el llamador recargue la tarima.
    let onSaved: () -> Void

    var body: some View {
        NavigationStack {
            List {
                ForEach(Array(model.sessions.enumerated()), id: \.offset) { index, _ in
                    SessionEditorSection(model: model, index: index)
                }
                .onDelete { model.removeSessions(at: $0) }

                Section {
                    Button {
                        withAnimation { model.addSession() }
                    } label: {
                        Label("Añadir sesión", systemImage: "plus.circle")
                    }
                } footer: {
                    Text("\(model.sessions.count) sesiones · \(model.totalSlots) plazas en total. Pon una plaza a 0 para quitarla.")
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Editar plantilla")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Guardar") {
                        Task {
                            if await model.save() {
                                onSaved()
                                dismiss()
                            }
                        }
                    }
                    .disabled(model.isSaving || !model.isValid)
                }
            }
            .overlay {
                if model.isSaving { ProgressView().controlSize(.large) }
            }
            .alert(
                "No se pudo guardar",
                isPresented: Binding(
                    get: { model.errorMessage != nil },
                    set: { if !$0 { model.errorMessage = nil } }
                )
            ) {
                Button("OK", role: .cancel) { model.errorMessage = nil }
            } message: {
                Text(model.errorMessage ?? "")
            }
        }
    }
}

/// Una sesión editable: metadatos + roles de competición + roles de pesaje.
private struct SessionEditorSection: View {
    @Bindable var model: TemplateEditorViewModel
    let index: Int

    var body: some View {
        if model.sessions.indices.contains(index) {
            Section {
                TextField("Nombre de la sesión", text: $model.sessions[index].nombre)
                TextField("Día (ej. Sábado 17 may)", text: $model.sessions[index].dia)
                TextField("Horario competición (ej. 10:00 - 13:30)", text: $model.sessions[index].horarioCompeticion)
                TextField("Horario pesaje (ej. 08:00 - 09:30)", text: $model.sessions[index].horarioPesaje)

                roleBlock(title: "Competición", roles: model.sessions[index].roles, pesaje: false)
                roleBlock(title: "Pesaje", roles: model.sessions[index].pesajeRoles, pesaje: true)
            } header: {
                Text(model.sessions[index].nombre.isEmpty ? "Sesión \(index + 1)" : model.sessions[index].nombre)
            }
        }
    }

    @ViewBuilder
    private func roleBlock(title: String, roles: [RosterRole], pesaje: Bool) -> some View {
        let available = model.availableRoleTypes(forSession: index, pesaje: pesaje)
        DisclosureGroup("\(title) · \(roles.reduce(0) { $0 + max($1.slots, 0) }) plazas") {
            ForEach(roles, id: \.key) { role in
                RoleSlotRow(
                    label: role.rol,
                    slots: role.slots,
                    onChange: { model.setSlots($0, roleKey: role.key, inSession: index, pesaje: pesaje) },
                    onRemove: { model.removeRole(key: role.key, fromSession: index, pesaje: pesaje) }
                )
            }
            if !available.isEmpty {
                Menu {
                    ForEach(available) { type in
                        Button(type.label) { model.addRole(type, toSession: index, pesaje: pesaje) }
                    }
                } label: {
                    Label("Añadir rol", systemImage: "plus")
                        .font(.subheadline)
                }
            }
        }
    }
}

/// Fila de un rol con stepper de plazas y borrado.
private struct RoleSlotRow: View {
    let label: String
    let slots: Int
    let onChange: (Int) -> Void
    let onRemove: () -> Void

    var body: some View {
        HStack {
            Text(label)
            Spacer()
            Text("\(slots)")
                .monospacedDigit()
                .foregroundStyle(slots == 0 ? .tertiary : .secondary)
                .frame(minWidth: 22, alignment: .trailing)
            Stepper(
                value: Binding(get: { slots }, set: { onChange($0) }),
                in: 0...9
            ) { EmptyView() }
            .labelsHidden()
        }
        .swipeActions(edge: .trailing) {
            Button(role: .destructive, action: onRemove) {
                Label("Quitar", systemImage: "trash")
            }
        }
    }
}
