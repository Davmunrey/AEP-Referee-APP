import SwiftUI
import AEPTarimaCore

/// Enrutado raíz según el estado de sesión.
struct RootView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        switch session.state {
        case .loading:
            ProgressView("Cargando…")
        case .lockedBiometric:
            BiometricLockView()
        case let .signedOut(message):
            LoginView(initialMessage: message)
        case let .signedIn(user):
            HomeView(user: user)
        }
    }
}

/// Pantalla de bloqueo cuando hay sesión pero falta el desbloqueo Face ID.
struct BiometricLockView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "faceid").font(.system(size: 56))
            Text("AEP Tarima").font(.title2).bold()
            Button("Desbloquear con Face ID") {
                Task { await session.unlockBiometric() }
            }
            .buttonStyle(.borderedProminent)
            Button("Usar otra cuenta") {
                Task { await session.signOut() }
            }
            .font(.footnote)
        }
        .padding()
        .task { await session.unlockBiometric() }
    }
}
