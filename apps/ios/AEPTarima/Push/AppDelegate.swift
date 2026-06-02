import UIKit
import UserNotifications

/// Puente sin estado entre el `AppDelegate` (creado por SwiftUI) y el
/// `PushManager`/`NotificationRouter` (que viven en el `SessionStore`).
/// El PushManager registra estos closures en su init.
enum PushBridge {
    @MainActor static var onToken: ((Data) -> Void)?
    @MainActor static var onNotification: (([AnyHashable: Any]) -> Void)?
}

/// Recibe los callbacks de APNs y los reenvía al puente.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in PushBridge.onToken?(deviceToken) }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        #if DEBUG
        print("[push] registro APNs falló: \(error.localizedDescription)")
        #endif
    }

    /// Mostrar la notificación aunque la app esté en primer plano.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }

    /// El usuario tocó la notificación: enrutar al destino.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let info = response.notification.request.content.userInfo
        await MainActor.run { PushBridge.onNotification?(info) }
    }
}
