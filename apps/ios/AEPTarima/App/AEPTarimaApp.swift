import SwiftUI

@main
struct AEPTarimaApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var session = SessionStore()

    private var isUIPreview: Bool {
        ProcessInfo.processInfo.arguments.contains("-uiPreview")
    }

    var body: some Scene {
        WindowGroup {
            if isUIPreview {
                // Modo escaparate para capturas en CI (sin red ni sesión).
                GalleryView()
            } else {
                RootView()
                    .environment(session)
                    .tint(Theme.accent)
                    .task { await session.bootstrap() }
            }
        }
    }
}
