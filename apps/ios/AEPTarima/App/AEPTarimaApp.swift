import SwiftUI
import UIKit

@main
struct AEPTarimaApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var session = SessionStore()

    init() { Self.configureBrandAppearance() }

    private var isUIPreview: Bool {
        ProcessInfo.processInfo.arguments.contains("-uiPreview")
    }

    var body: some Scene {
        WindowGroup {
            if isUIPreview {
                // Modo escaparate para capturas en CI (sin red ni sesión).
                GalleryView()
                    .tint(Theme.accent)
                    .preferredColorScheme(.light)
            } else {
                RootView()
                    .environment(session)
                    .tint(Theme.accent)
                    .font(.aepBody)               // DM Sans por defecto (como la web)
                    .preferredColorScheme(.light) // tema claro de marca AEP
                    .task { await session.bootstrap() }
            }
        }
    }

    /// Aplica la identidad AEP a los componentes UIKit (barras de navegación):
    /// tipografía DM Sans y color de marca. Tolerante si la fuente no carga.
    private static func configureBrandAppearance() {
        let titleFont = UIFont(name: "DM Sans", size: 17) ?? .systemFont(ofSize: 17, weight: .semibold)
        let largeFont = UIFont(name: "DM Sans", size: 32) ?? .systemFont(ofSize: 32, weight: .bold)
        let fg = UIColor(Theme.foreground)

        let appearance = UINavigationBarAppearance()
        appearance.configureWithDefaultBackground()
        appearance.titleTextAttributes = [.font: titleFont, .foregroundColor: fg]
        appearance.largeTitleTextAttributes = [.font: largeFont, .foregroundColor: fg]

        let bar = UINavigationBar.appearance()
        bar.standardAppearance = appearance
        bar.scrollEdgeAppearance = appearance
        bar.compactAppearance = appearance
        bar.tintColor = UIColor(Theme.accent)
    }
}
