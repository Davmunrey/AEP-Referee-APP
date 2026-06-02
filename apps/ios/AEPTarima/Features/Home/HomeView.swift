import SwiftUI
import AEPTarimaCore

/// Pantalla principal autenticada (vertical slice de la Fase 1). Más adelante
/// se amplía con Dashboard, Tarima, Directorio, etc. (ver plan).
struct HomeView: View {
    let user: SessionUser

    var body: some View {
        TabView {
            CompetitionsTab(user: user)
                .tabItem { Label("Campeonatos", systemImage: "calendar") }
            RefereesView()
                .tabItem { Label("Jueces", systemImage: "person.3") }
            ApprovalsView(user: user)
                .tabItem { Label("Aprobaciones", systemImage: "checkmark.seal") }
            PromotionsView(user: user)
                .tabItem { Label("Ascensos", systemImage: "arrow.up.circle") }
            ProfileTab(user: user)
                .tabItem { Label("Perfil", systemImage: "person.crop.circle") }
        }
    }
}

private struct CompetitionsTab: View {
    @Environment(SessionStore.self) private var session
    let user: SessionUser
    @State private var model: HomeViewModel?

    var body: some View {
        NavigationStack {
            Group {
                switch model?.loadState ?? .idle {
                case .idle, .loading:
                    ProgressView("Cargando campeonatos…")
                case .loaded:
                    if let comps = model?.competitions, !comps.isEmpty {
                        List(comps) { CompetitionRow(competition: $0) }
                            .listStyle(.insetGrouped)
                    } else {
                        ContentUnavailableView("Sin campeonatos", systemImage: "calendar.badge.exclamationmark")
                    }
                case let .failed(message):
                    ContentUnavailableView {
                        Label("No se pudo cargar", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("Reintentar") { Task { await model?.load() } }
                    }
                }
            }
            .navigationTitle("Campeonatos")
            .refreshable { await model?.load() }
        }
        .task {
            if model == nil { model = HomeViewModel(api: session.api) }
            await model?.load()
        }
    }
}

private struct CompetitionRow: View {
    let competition: Competition

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(competition.nombre).font(.headline)
            HStack(spacing: 8) {
                Text(competition.tipo.rawValue)
                Text("·")
                Text(competition.sede)
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
            HStack {
                Label("\(competition.confirmados)/\(competition.requeridos)", systemImage: "person.2")
                Spacer()
                Text(competition.estado.rawValue)
                    .font(.caption).bold()
                    .padding(.horizontal, 8).padding(.vertical, 2)
                    .background(estadoColor.opacity(0.15), in: Capsule())
                    .foregroundStyle(estadoColor)
            }
            .font(.caption)
        }
        .padding(.vertical, 4)
    }

    private var estadoColor: Color {
        switch competition.estado {
        case .completo: return .green
        case .incompleto: return .orange
        case .critico: return .red
        case .borrador, .unknown: return .secondary
        }
    }
}

private struct ProfileTab: View {
    @Environment(SessionStore.self) private var session
    let user: SessionUser
    @State private var biometricEnabled = BiometricPreference.isEnabled

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent("Nombre", value: user.nombre)
                    LabeledContent("Correo", value: user.email)
                    LabeledContent("Rol", value: user.rol)
                    if let zona = user.zona { LabeledContent("Zona", value: zona) }
                }
                if BiometricService.isAvailable {
                    Section("Seguridad") {
                        Toggle("Desbloqueo con Face ID", isOn: $biometricEnabled)
                            .onChange(of: biometricEnabled) { _, newValue in
                                BiometricPreference.isEnabled = newValue
                            }
                    }
                }
                Section {
                    Button("Cerrar sesión", role: .destructive) {
                        Task { await session.signOut() }
                    }
                }
            }
            .navigationTitle("Perfil")
        }
    }
}
