import SwiftUI
import AEPTarimaCore

/// Cuadro de mando: KPIs, salud operativa, insights y cobertura. Offline.
struct DashboardView: View {
    @Environment(SessionStore.self) private var session
    @State private var model: DashboardViewModel?

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 12)]

    var body: some View {
        NavigationStack {
            Group {
                if let model {
                    LoadableView(state: model.state, retry: { await model.load() }) { dash in
                        ScrollView {
                            if model.isOffline { OfflineBanner() }
                            VStack(alignment: .leading, spacing: 20) {
                                kpiGrid(dash.kpis)
                                healthCard(dash.health)
                                if !dash.insights.isEmpty { insightsSection(dash.insights) }
                                if !dash.coverage.isEmpty { coverageSection(dash.coverage) }
                            }
                            .padding()
                        }
                    }
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Inicio")
            .refreshable { await model?.load() }
        }
        .task {
            if model == nil { model = DashboardViewModel(api: session.api) }
            if case .idle? = model?.state { await model?.load() }
        }
    }

    private func kpiGrid(_ kpis: [DashboardKpi]) -> some View {
        LazyVGrid(columns: columns, spacing: 12) {
            ForEach(kpis) { kpi in
                VStack(alignment: .leading, spacing: 4) {
                    Text(kpi.label).font(.caption).foregroundStyle(.secondary)
                    Text(kpi.value).font(.title2).bold()
                        .foregroundStyle(Theme.kpiColor(kpi.accent))
                    Text(kpi.sub).font(.caption2).foregroundStyle(.secondary)
                    Text(kpi.trend).font(.caption2).foregroundStyle(Theme.kpiColor(kpi.accent))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
            }
        }
    }

    private func healthCard(_ health: OperationalHealth) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Salud operativa").font(.headline)
                Spacer()
                Text("\(Int(health.score))")
                    .font(.title).bold()
                    .foregroundStyle(Theme.healthColor(health.status))
            }
            Text(health.status.capitalized)
                .font(.caption).bold()
                .foregroundStyle(Theme.healthColor(health.status))
            Text(health.summary).font(.subheadline).foregroundStyle(.secondary)
            ForEach(health.factors) { factor in
                HStack {
                    Text(factor.label).font(.caption)
                    Spacer()
                    ProgressView(value: max(0, min(factor.score, 1)))
                        .frame(width: 80)
                }
            }
        }
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
    }

    private func insightsSection(_ insights: [Insight]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Avisos").font(.headline)
            ForEach(insights) { insight in
                HStack(alignment: .top, spacing: 10) {
                    Circle().fill(Theme.severityColor(insight.severity)).frame(width: 8, height: 8).padding(.top, 6)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(insight.title).font(.subheadline).bold()
                        Text(insight.detail).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
    }

    private func coverageSection(_ coverage: [EventCoverage]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Cobertura de eventos").font(.headline)
            ForEach(coverage) { event in
                HStack {
                    VStack(alignment: .leading) {
                        Text(event.nombre).font(.subheadline)
                        Text(event.fecha).font(.caption2).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text("\(event.filled)/\(event.requiredSlots)")
                        .font(.caption).bold()
                        .foregroundStyle(event.open == 0 ? .green : .orange)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
    }
}
