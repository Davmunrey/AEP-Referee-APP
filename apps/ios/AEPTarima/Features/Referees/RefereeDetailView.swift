import SwiftUI
import AEPTarimaCore

/// Ficha de juez: datos, sanciones, exámenes e informes. Permite editar y
/// añadir exámenes/informes (si el rol puede gestionar jueces).
struct RefereeDetailView: View {
    @Environment(SessionStore.self) private var session
    let user: SessionUser
    @State private var referee: Referee
    @State private var model: RefereeDetailViewModel? = nil
    @State private var showEdit = false
    @State private var showExam = false
    @State private var showReport = false
    @State private var showSanction = false

    init(referee: Referee, user: SessionUser) {
        self.user = user
        _referee = State(initialValue: referee)
    }

    private var canEdit: Bool { user.role.canEdit }

    var body: some View {
        List {
            Section("Datos") {
                LabeledContent("Nivel", value: referee.nivel.rawValue)
                LabeledContent("Zona", value: referee.zona)
                LabeledContent("Estado", value: referee.estado.rawValue)
                LabeledContent("Eventos", value: "\(referee.eventos)")
                if let email = referee.email { LabeledContent("Correo", value: email) }
                if let tel = referee.telefono { LabeledContent("Teléfono", value: tel) }
                if let loc = referee.localidad { LabeledContent("Localidad", value: loc) }
                if let lic = referee.licencia { LabeledContent("Licencia", value: lic) }
            }

            if let model {
                switch model.state {
                case .idle, .loading:
                    Section { HStack { Spacer(); ProgressView(); Spacer() } }
                case let .failed(message):
                    Section { Text(message).foregroundStyle(.secondary) }
                case let .loaded(detail):
                    sanctionsSection(detail.sanctions)
                    examsSection(detail.exams)
                    reportsSection(detail.reports)
                }
            }
        }
        .navigationTitle(referee.nombre)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if canEdit {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Editar") { showEdit = true }
                }
            }
        }
        .sheet(isPresented: $showEdit) {
            EditRefereeSheet(referee: referee) { patch in
                let updated = await model?.updateReferee(patch) ?? nil
                if let updated { referee = updated }
                return updated
            }
        }
        .sheet(isPresented: $showExam) {
            NewExamSheet(refereeId: referee.id) { payload in
                await model?.createExam(payload) ?? false
            }
        }
        .sheet(isPresented: $showReport) {
            NewReportSheet(refereeId: referee.id) { payload in
                await model?.createReport(payload) ?? false
            }
        }
        .sheet(isPresented: $showSanction) {
            NewSanctionSheet { payload in
                await model?.createSanction(payload) ?? false
            }
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
            if model == nil { model = RefereeDetailViewModel(api: session.api, refereeId: referee.id) }
            if case .idle? = model?.state { await model?.load() }
        }
    }

    @ViewBuilder private func sanctionsSection(_ items: [RefereeSanction]) -> some View {
        Section("Sanciones") {
            if items.isEmpty {
                Text("Sin sanciones").foregroundStyle(.secondary)
            } else {
                ForEach(items) { s in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(s.motivo).font(.subheadline)
                        Text("\(s.fechaInicio) – \(s.fechaFin) · \(s.status)")
                            .font(.caption).foregroundStyle(.secondary)
                        if canEdit && s.status == "vigente" {
                            Button("Revocar", role: .destructive) {
                                Task { await model?.revokeSanction(s.id, motivo: "") }
                            }
                            .font(.caption)
                        }
                    }
                }
            }
            if canEdit {
                Button { showSanction = true } label: { Label("Sancionar", systemImage: "exclamationmark.triangle") }
            }
        }
    }

    @ViewBuilder private func examsSection(_ items: [RefereeExam]) -> some View {
        Section("Exámenes") {
            if items.isEmpty {
                Text("Sin exámenes").foregroundStyle(.secondary)
            } else {
                ForEach(items) { e in
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(e.tipo.rawValue) → \(e.nivelObjetivo.rawValue)").font(.subheadline)
                        Text("\(e.fecha) · \(e.resultado.rawValue)")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .swipeActions(edge: .trailing) {
                        if canEdit {
                            Button(role: .destructive) {
                                Task { await model?.deleteExam(e.id) }
                            } label: { Label("Borrar", systemImage: "trash") }
                        }
                    }
                }
            }
            if canEdit {
                Button { showExam = true } label: { Label("Añadir examen", systemImage: "plus") }
            }
        }
    }

    @ViewBuilder private func reportsSection(_ items: [RefereeReport]) -> some View {
        Section("Informes") {
            if items.isEmpty {
                Text("Sin informes").foregroundStyle(.secondary)
            } else {
                ForEach(items) { r in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.titulo).font(.subheadline)
                        Text(r.tipo.rawValue).font(.caption).foregroundStyle(.secondary)
                    }
                    .swipeActions(edge: .trailing) {
                        if canEdit {
                            Button(role: .destructive) {
                                Task { await model?.deleteReport(r.id) }
                            } label: { Label("Borrar", systemImage: "trash") }
                        }
                    }
                }
            }
            if canEdit {
                Button { showReport = true } label: { Label("Añadir informe", systemImage: "plus") }
            }
        }
    }
}
