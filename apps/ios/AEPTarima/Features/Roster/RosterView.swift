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
    @State private var editorModel: TemplateEditorViewModel?

    var body: some View {
        Group {
            if let model {
                LoadableView(state: model.state, retry: { await model.load() }) { payload in
                    if payload.template.isEmpty {
                        ContentUnavailableView {
                            Label("Tarima sin configurar", systemImage: "square.grid.3x3")
                        } description: {
                            Text(canEdit
                                ? "Esta competición aún no tiene plazas. Genera la plantilla AEP estándar para su tipo, o crea una personalizada, y empieza a asignar jueces."
                                : "Esta competición aún no tiene tarima configurada.")
                        } actions: {
                            if canEdit {
                                Button {
                                    Task { await model.applyPreset() }
                                } label: {
                                    Label("Generar plantilla AEP", systemImage: "wand.and.stars")
                                }
                                .buttonStyle(.borderedProminent)
                                .disabled(model.isWorking)

                                Button {
                                    editorModel = model.makeTemplateEditor()
                                } label: {
                                    Label("Crear plantilla personalizada", systemImage: "slider.horizontal.3")
                                }
                                .disabled(model.isWorking)
                            }
                        }
                    } else {
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
                    Menu {
                        Button {
                            if let model { editorModel = model.makeTemplateEditor() }
                        } label: {
                            Label("Editar plantilla", systemImage: "slider.horizontal.3")
                        }
                        Button {
                            Task { submitted = await model?.submit() == true }
                        } label: {
                            Label("Enviar a aprobación", systemImage: "paperplane")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
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
        .sheet(item: $editorModel) { editor in
            TemplateEditorView(model: editor) {
                Task { await model?.load() }
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
