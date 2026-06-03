import SwiftUI
import AEPTarimaCore

/// Pantalla principal autenticada (vertical slice de la Fase 1). Más adelante
/// se amplía con Dashboard, Tarima, Directorio, etc. (ver plan).
struct HomeView: View {
    @Environment(SessionStore.self) private var session
    let user: SessionUser

    var body: some View {
        @Bindable var router = session.router
        TabView(selection: $router.selectedTab) {
            DashboardView()
                .tag(HomeTab.dashboard)
                .tabItem { Label("Inicio", systemImage: "house") }
            CompetitionsTab(user: user)
                .tag(HomeTab.competitions)
                .tabItem { Label("Campeonatos", systemImage: "calendar") }
            RefereesView(user: user)
                .tag(HomeTab.referees)
                .tabItem { Label("Jueces", systemImage: "person.3") }
            ApprovalsView(user: user)
                .tag(HomeTab.approvals)
                .tabItem { Label("Aprobaciones", systemImage: "checkmark.seal") }
            MoreTab(user: user)
                .tag(HomeTab.more)
                .tabItem { Label("Más", systemImage: "ellipsis.circle") }
        }
    }
}

private struct CompetitionsTab: View {
    @Environment(SessionStore.self) private var session
    let user: SessionUser
    @State private var model: HomeViewModel?
    @State private var showScan = false
    @State private var showNew = false

    var body: some View {
        NavigationStack {
            Group {
                switch model?.loadState ?? .idle {
                case .idle, .loading:
                    ProgressView("Cargando campeonatos…")
                case .loaded:
                    VStack(spacing: 0) {
                        if model?.isOffline == true { OfflineBanner() }
                        if let comps = model?.competitions, !comps.isEmpty {
                            List(comps) { competition in
                                NavigationLink(value: competition) {
                                    CompetitionRow(competition: competition)
                                }
                            }
                            .listStyle(.insetGrouped)
                        } else {
                            ContentUnavailableView("Sin campeonatos", systemImage: "calendar.badge.exclamationmark")
                        }
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
            .navigationDestination(for: Competition.self) { competition in
                CompetitionDetailView(competition: competition, user: user)
            }
            .refreshable { await model?.load() }
            .toolbar {
                if user.role.canEdit {
                    ToolbarItem(placement: .topBarLeading) {
                        Button { showNew = true } label: { Image(systemName: "plus") }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showScan = true
                    } label: {
                        Label("Escanear", systemImage: "doc.viewfinder")
                    }
                }
            }
            .sheet(isPresented: $showScan) { ScanView() }
            .sheet(isPresented: $showNew) {
                NewCompetitionSheet(user: user) { payload in
                    await model?.create(payload) ?? false
                }
            }
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

/// Hub "Más": gestión secundaria (Ascensos, Analítica), referencia (Normativa)
/// y perfil/seguridad. Cada destino es push-friendly (sin NavigationStack propio).
private struct MoreTab: View {
    @Environment(SessionStore.self) private var session
    let user: SessionUser
    @State private var biometricEnabled = BiometricPreference.isEnabled
    @State private var showChangePassword = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent("Nombre", value: user.nombre)
                    LabeledContent("Correo", value: user.email)
                    LabeledContent("Rol", value: user.rol)
                    if let zona = user.zona { LabeledContent("Zona", value: zona) }
                }
                Section("Gestión") {
                    NavigationLink {
                        PromotionsView(user: user)
                    } label: {
                        Label("Ascensos", systemImage: "arrow.up.circle")
                    }
                    NavigationLink {
                        AnalyticsView()
                    } label: {
                        Label("Analítica", systemImage: "chart.bar")
                    }
                }
                Section("Referencia") {
                    NavigationLink {
                        RegulationsView()
                    } label: {
                        Label("Normativa IPF", systemImage: "book.closed")
                    }
                }
                if user.role.canApprove {
                    Section("Administración") {
                        NavigationLink {
                            AdminUsersView()
                        } label: {
                            Label("Usuarios", systemImage: "person.2.badge.gearshape")
                        }
                    }
                }
                Section("Seguridad") {
                    if BiometricService.isAvailable {
                        Toggle("Desbloqueo con Face ID", isOn: $biometricEnabled)
                            .onChange(of: biometricEnabled) { _, newValue in
                                BiometricPreference.isEnabled = newValue
                            }
                    }
                    Button {
                        showChangePassword = true
                    } label: {
                        Label("Cambiar contraseña", systemImage: "key")
                    }
                }
                Section {
                    Button("Cerrar sesión", role: .destructive) {
                        Task { await session.signOut() }
                    }
                }
            }
            .navigationTitle("Más")
            .sheet(isPresented: $showChangePassword) {
                ChangePasswordSheet { current, nuevo in
                    do {
                        try await session.api.sendIgnoringBody(.changePassword(current: current, new: nuevo))
                        return nil
                    } catch let error as APIError {
                        return error.userMessage
                    } catch {
                        return "No se pudo cambiar la contraseña."
                    }
                }
            }
        }
    }
}
