import SwiftUI

@main
struct AEPTarimaApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .tint(Theme.accent)
                .task { await session.bootstrap() }
        }
    }
}
