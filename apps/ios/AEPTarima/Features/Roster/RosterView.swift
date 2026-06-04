import SwiftUI
import AEPTarimaCore

/// Builder de tarima: muestra las sesiones y plazas, permite asignar jueces por
/// toque (si el usuario puede editar) y enviar la propuesta a aprobación.
struct RosterView: View {
    @Environment(SessionStore.self) private var session
    let competition: Competition
    let canEdit: Bool

    @State private var model: RosterViewModel?
    @State private var pickerSlot: RosterSlot?
    @State private var submitted = false

    var body: some View {
        Group {
            if let model {
                LoadableView(state: model.state, retry: { await model.load() }) { payload in
                    List {
                        ForEach(Array(payload.template.enumerated()), id: \.offset) { _, sesion in
                            Section("\(sesion.nombre) · \(sesion.dia)") {
                                ForEach(model.slots(for: sesion)) { slot in
                                    slotRow(model: model, slot: slot)
                                        .swipeActions(edge: .trailing) {
                                            if canEdit, model.assignedReferee(forSlot: slot.key) != nil {
                                                Button(role: .destructive) {
                                                    Task { await model.clearSlot(slot.key) }
                                                } label: { Label("Quitar", systemImage: "person.badge.minus") }
                                            }
                                        }
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            } else {
                ProgressView()
            }
        }
        .navigationTitle("Tarima")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if canEdit {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Enviar") {
                        Task { submitted = await model?.submit() == true }
                    }
                    .disabled(model?.isWorking ?? true)
                }
            }
        }
        .sheet(item: $pickerSlot) { slot in
            RefereePicker(referees: model?.referees ?? []) { referee in
                Task { await model?.assign(slotKey: slot.key, refereeId: referee.id) }
            }
        }
        .alert("Propuesta enviada", isPresented: $submitted) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("La tarima se ha enviado a aprobación nacional.")
        }
        .alert(
            "No se pudo completar",
            isPresented: Binding(
                get: { model?.errorMessage != nil },
                set: { if !$0 { model?.errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) { model?.errorMessage = nil }
        } message: {
            Text(model?.errorMessage ?? "")
        }
        .task {
            if model == nil { model = RosterViewModel(api: session.api, competition: competition) }
            if case .idle? = model?.state { await model?.load() }
        }
    }

    @ViewBuilder
    private func slotRow(model: RosterViewModel, slot: RosterSlot) -> some View {
        Button {
            if canEdit { pickerSlot = slot }
        } label: {
            HStack {
                Text("\(slot.roleName) \(slot.index + 1)")
                Spacer()
                if let referee = model.assignedReferee(forSlot: slot.key) {
                    Text(referee.nombre).foregroundStyle(.primary)
                } else {
                    Text("Sin asignar").foregroundStyle(.secondary)
                }
                if canEdit {
                    Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                }
            }
        }
        .disabled(!canEdit)
        .foregroundStyle(.primary)
    }
}
