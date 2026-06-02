import SwiftUI
import Observation
import AEPTarimaCore

@MainActor
@Observable
final class PromotionsViewModel {
    private let api: APIClient
    private(set) var state: Loadable<[PromotionRequest]> = .idle
    var isReviewing = false

    init(api: APIClient) { self.api = api }

    func load() async {
        state = .loading
        do {
            let items: [PromotionRequest] = try await api.send(.promotions)
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
            let _: PromotionRequest = try await api.send(.reviewPromotion(id, approve: approve))
            await load()
        } catch { }
    }
}

/// Solicitudes de ascenso. El comité nacional puede aprobar/rechazar.
struct PromotionsView: View {
    @Environment(SessionStore.self) private var session
    let user: SessionUser
    @State private var model: PromotionsViewModel?

    var body: some View {
        NavigationStack {
            Group {
                if let model {
                    LoadableView(state: model.state, retry: { await model.load() }) { promos in
                        if promos.isEmpty {
                            ContentUnavailableView("Sin ascensos", systemImage: "arrow.up.circle")
                        } else {
                            List(promos) { promo in
                                PromotionRow(
                                    promo: promo,
                                    canReview: user.role.canApprove && promo.status == .pendiente,
                                    isReviewing: model.isReviewing,
                                    onReview: { approve in
                                        Task { await model.review(promo.id, approve: approve) }
                                    }
                                )
                            }
                            .listStyle(.insetGrouped)
                        }
                    }
                } else { ProgressView() }
            }
            .navigationTitle("Ascensos")
            .refreshable { await model?.load() }
        }
        .task {
            if model == nil { model = PromotionsViewModel(api: session.api) }
            if case .idle? = model?.state { await model?.load() }
        }
    }
}

private struct PromotionRow: View {
    let promo: PromotionRequest
    let canReview: Bool
    let isReviewing: Bool
    let onReview: (Bool) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(promo.refereeName).font(.headline)
            Text("\(promo.fromLevel.rawValue) → \(promo.toLevel.rawValue) · \(promo.zona)")
                .font(.subheadline).foregroundStyle(.secondary)
            Text("\(promo.eventosCompletados) eventos completados")
                .font(.caption).foregroundStyle(.secondary)
            StatusBadge(status: promo.status)
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
