import SwiftUI
import AEPTarimaCore

/// Cuadro de mando: KPIs, salud operativa, avisos y cobertura. Tarjetas claras
/// con espaciado generoso (espeja el dashboard web). Offline-aware.
struct DashboardView: View {
    @Environment(SessionStore.self) private var session
    @State private var model: DashboardViewModel?

    private let columns = [GridItem(.adaptive(minimum: 158), spacing: 12)]

    var body: some View {
        NavigationStack {
            Group {
                if let model {
                    LoadableView(state: model.state, retry: { await model.load() }) { dash in
                        ScrollView {
                            if model.isOffline { OfflineBanner() }
                            VStack(alignment: .leading, spacing: 16) {
                                kpiGrid(dash.kpis)
                                healthCard(dash.health)
                                if !dash.insights.isEmpty { insightsSection(dash.insights) }
                                if let upcoming = dash.upcomingCompetitions, !upcoming.isEmpty {
                                    upcomingSection(upcoming)
                                }
                                if !dash.coverage.isEmpty { coverageSection(dash.coverage) }
                                if let activity = dash.activity, !activity.isEmpty {
                                    activitySection(activity)
                                }
                            }
                            .padding(16)
                        }
                        .background(Theme.background)
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

    // MARK: - Tarjeta base (blanca con borde sutil, como la web)

    private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        content()
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text).font(.aepHeadline).foregroundStyle(Theme.foreground)
    }

    // MARK: - Secciones

    private func kpiGrid(_ kpis: [DashboardKpi]) -> some View {
        LazyVGrid(columns: columns, spacing: 12) {
            ForEach(kpis) { kpi in
                VStack(alignment: .leading, spacing: 4) {
                    Text(kpi.label).font(.aepCaption).foregroundStyle(Theme.subtle)
                    Text(kpi.value).font(.aep(26, relativeTo: .title)).bold()
                        .foregroundStyle(Theme.kpiColor(kpi.accent))
                    Text(kpi.sub).font(.aepCaption).foregroundStyle(Theme.subtle).lineLimit(1)
                    Text(kpi.trend).font(.aepCaption).foregroundStyle(Theme.kpiColor(kpi.accent)).lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
            }
        }
    }

    private func healthCard(_ health: OperationalHealth) -> some View {
        card {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    sectionTitle("Salud operativa")
                    Spacer()
                    Text("\(Int(health.score))")
                        .font(.aep(30, relativeTo: .title)).bold()
                        .foregroundStyle(Theme.healthColor(health.status))
                }
                Text(health.status.capitalized)
                    .font(.aepCaption).bold()
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Theme.healthColor(health.status).opacity(0.14), in: Capsule())
                    .foregroundStyle(Theme.healthColor(health.status))
                Text(health.summary).font(.aepCallout).foregroundStyle(Theme.subtle)
                VStack(spacing: 8) {
                    ForEach(health.factors) { factor in
                        HStack(spacing: 12) {
                            Text(factor.label).font(.aepFootnote).foregroundStyle(Theme.foregroundSecondary)
                            Spacer()
                            ProgressView(value: max(0, min(factor.score, 1)))
                                .tint(Theme.accent)
                                .frame(width: 96)
                        }
                    }
                }
                .padding(.top, 2)
            }
        }
    }

    private func insightsSection(_ insights: [Insight]) -> some View {
        card {
            VStack(alignment: .leading, spacing: 0) {
                sectionTitle("Avisos").padding(.bottom, 10)
                ForEach(Array(insights.prefix(5).enumerated()), id: \.element.id) { index, insight in
                    if index > 0 { Divider() }
                    HStack(alignment: .top, spacing: 10) {
                        Circle().fill(Theme.severityColor(insight.severity))
                            .frame(width: 8, height: 8).padding(.top, 6)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(insight.title).font(.aepCallout).bold().foregroundStyle(Theme.foreground)
                            Text(insight.detail).font(.aepCaption).foregroundStyle(Theme.subtle)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 8)
                }
            }
        }
    }

    private func upcomingSection(_ comps: [Competition]) -> some View {
        card {
            VStack(alignment: .leading, spacing: 0) {
                sectionTitle("Próximos campeonatos").padding(.bottom, 10)
                ForEach(Array(comps.prefix(5).enumerated()), id: \.element.id) { index, comp in
                    if index > 0 { Divider() }
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(comp.nombre).font(.aepCallout).foregroundStyle(Theme.foreground).lineLimit(1)
                            Text("\(comp.fecha) · \(comp.sede)").font(.aepCaption).foregroundStyle(Theme.subtle).lineLimit(1)
                        }
                        Spacer(minLength: 0)
                        Text(comp.tipo.rawValue).font(.aepCaption).bold()
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Theme.surface, in: Capsule())
                            .foregroundStyle(Theme.foregroundSecondary)
                    }
                    .padding(.vertical, 9)
                }
            }
        }
    }

    private func coverageSection(_ coverage: [EventCoverage]) -> some View {
        card {
            VStack(alignment: .leading, spacing: 0) {
                sectionTitle("Cobertura de eventos").padding(.bottom, 10)
                ForEach(Array(coverage.prefix(6).enumerated()), id: \.element.id) { index, event in
                    if index > 0 { Divider() }
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(event.nombre).font(.aepCallout).foregroundStyle(Theme.foreground).lineLimit(1)
                            Text(event.fecha).font(.aepCaption).foregroundStyle(Theme.subtle)
                        }
                        Spacer(minLength: 0)
                        Text("\(event.filled)/\(event.requiredSlots)")
                            .font(.aepCallout).bold().monospacedDigit()
                            .foregroundStyle(event.open == 0 ? Theme.success : Theme.warning)
                    }
                    .padding(.vertical, 9)
                }
                if coverage.count > 6 {
                    Text("y \(coverage.count - 6) más en Campeonatos")
                        .font(.aepCaption).foregroundStyle(Theme.subtle).padding(.top, 8)
                }
            }
        }
    }

    private func activitySection(_ activity: [ActivityItem]) -> some View {
        card {
            VStack(alignment: .leading, spacing: 0) {
                sectionTitle("Actividad reciente").padding(.bottom, 10)
                ForEach(Array(activity.prefix(8).enumerated()), id: \.element.id) { index, item in
                    if index > 0 { Divider() }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(item.actor) \(item.accion) \(item.evento)")
                            .font(.aepFootnote).foregroundStyle(Theme.foreground)
                        Text(item.hace).font(.aepCaption).foregroundStyle(Theme.subtle)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 8)
                }
            }
        }
    }
}
