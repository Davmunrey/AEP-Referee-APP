import SwiftUI
import Observation
import AEPTarimaCore

@MainActor
@Observable
final class ApprovalsViewModel {
    private let api: APIClient
    private(set) var state: Loadable<[ApprovalProposal]> = .idle
    var isReviewing = false

    init(api: APIClient) { self.api = api }

    func load() async {
        state = .loading
        do {
            let items: [ApprovalProposal] = try await api.send(.approvals)
            state = .loaded(items)
        } catch let error as APIError {
            state = .failed(error.userMessage)
        } catch {
            state = .failed("Error inesperado.")
        }
    }

    func review(_ id: String, approve: Bool) async {
        isReviewing = true
        defer { isReviewing = false }
        do {
            let _: ApprovalProposal = try await api.send(.reviewApproval(id, approve: approve))
            await load()
        } catch {
            // El estado de error se refleja al recargar; aquí no bloqueamos la UI.
        }
    }
}

/// Tarimas pendientes de aprobación nacional. Los roles del comité pueden
/// aprobar/rechazar; el resto solo consulta.
struct ApprovalsView: View {
    @Environment(SessionStore.self) private var session
    let user: SessionUser
    @State private var model: ApprovalsViewModel?

    var body: some View {
        NavigationStack {
            Group {
                if let model {
                    LoadableView(state: model.state, retry: { await model.load() }) { proposals in
                        if proposals.isEmpty {
                            ContentUnavailableView("Sin propuestas", systemImage: "tray")
                        } else {
                            List(proposals) { proposal in
                                ApprovalRow(
                                    proposal: proposal,
                                    canReview: user.role.canApprove && proposal.status == .pendiente,
                                    isReviewing: model.isReviewing,
                                    onReview: { approve in
                                        Task { await model.review(proposal.id, approve: approve) }
                                    }
                                )
                            }
                            .listStyle(.insetGrouped)
                        }
                    }
                } else { ProgressView() }
            }
            .navigationTitle("Aprobaciones")
            .refreshable { await model?.load() }
        }
        .task {
            if model == nil { model = ApprovalsViewModel(api: session.api) }
            if case .idle? = model?.state { await model?.load() }
        }
    }
}

private struct ApprovalRow: View {
    let proposal: ApprovalProposal
    let canReview: Bool
    let isReviewing: Bool
    let onReview: (Bool) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(proposal.competitionName).font(.headline)
            Text("\(proposal.zona) · enviado por \(proposal.submittedBy)")
                .font(.caption).foregroundStyle(.secondary)
            StatusBadge(status: proposal.status)
            if canReview {
                HStack {
                    Button("Aprobar") { onReview(true) }
                        .buttonStyle(.borderedProminent).tint(.green)
                    Button("Rechazar") { onReview(false) }
                        .buttonStyle(.bordered).tint(.red)
                }
                .disabled(isReviewing)
                .padding(.top, 4)
            }
        }
        .padding(.vertical, 4)
    }
}

struct StatusBadge: View {
    let status: ApprovalStatus
    var body: some View {
        Text(label).font(.caption).bold()
            .padding(.horizontal, 8).padding(.vertical, 2)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }
    private var label: String {
        switch status {
        case .pendiente: "Pendiente"
        case .aprobado: "Aprobado"
        case .rechazado: "Rechazado"
        case .unknown: "—"
        }
    }
    private var color: Color {
        switch status {
        case .pendiente: .orange
        case .aprobado: .green
        case .rechazado: .red
        case .unknown: .secondary
        }
    }
}
