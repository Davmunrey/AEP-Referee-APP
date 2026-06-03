import SwiftUI
import AEPTarimaCore

/// Analítica nacional: totales, desglose por zona y top de jueces. Push-friendly
/// (sin NavigationStack propio); funciona offline.
struct AnalyticsView: View {
    @Environment(SessionStore.self) private var session
    @State private var model: AnalyticsViewModel?

    var body: some View {
        Group {
            if let model {
                LoadableView(state: model.state, retry: { await model.load() }) { data in
                    List {
                        if model.isOffline {
                            Section { OfflineBanner().listRowInsets(EdgeInsets()) }
                        }
                        Section("Totales \(data.selectedYear)") {
                            totalRow("Campeonatos", data.totals.competitions)
                            totalRow("Críticos", data.totals.criticalCompetitions)
                            totalRow("Jueces activos", data.totals.activeReferees)
                            totalRow("Plazas cubiertas", data.totals.filledSlots)
                            totalRow("Plazas abiertas", data.totals.openSlots)
                            totalRow("Aprobaciones pendientes", data.totals.pendingApprovals)
                            totalRow("Tasa de rechazo", Int((data.rejectionRate * 100).rounded()), suffix: "%")
                        }
                        Section("Actividad por zona") {
                            ForEach(data.activityByZone) { zone in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(zone.name).font(.subheadline).bold()
                                    Text("\(zone.competitions) camp. · \(zone.filledSlots)/\(zone.requiredSlots) plazas · \(zone.activeReferees) jueces")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        Section("Jueces más asignados") {
                            ForEach(data.topReferees) { referee in
                                HStack {
                                    Text(referee.nombre)
                                    Spacer()
                                    Text("\(referee.assignedSlots) plazas")
                                        .font(.caption).foregroundStyle(.secondary)
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
        .navigationTitle("Analítica")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if model == nil { model = AnalyticsViewModel(api: session.api) }
            if case .idle? = model?.state { await model?.load() }
        }
    }

    private func totalRow(_ label: String, _ value: Int, suffix: String = "") -> some View {
        LabeledContent(label, value: "\(value)\(suffix)")
    }
}
