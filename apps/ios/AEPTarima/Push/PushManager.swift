import Foundation
import Observation
import UIKit
import UserNotifications
import AEPTarimaCore

/// Gestiona el ciclo de vida de las notificaciones push en el dispositivo:
/// pide permiso, registra el token APNs en el backend (`POST /devices`) y lo da
/// de baja al cerrar sesión. La recepción/enrutado la maneja `NotificationRouter`.
@MainActor
@Observable
final class PushManager {
    private let api: APIClient
    let router: NotificationRouter
    private(set) var registeredToken: String?

    init(api: APIClient, router: NotificationRouter) {
        self.api = api
        self.router = router
        PushBridge.onToken = { [weak self] data in self?.handleToken(data) }
        PushBridge.onNotification = { [weak self] info in self?.router.handle(userInfo: info) }
    }

    /// Pide permiso y, si se concede, registra el dispositivo en APNs.
    func start() async {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        guard granted else { return }
        UIApplication.shared.registerForRemoteNotifications()
    }

    func unregister() async {
        guard let token = registeredToken else { return }
        try? await api.sendIgnoringBody(.unregisterDevice(token: token))
        registeredToken = nil
    }

    private func handleToken(_ data: Data) {
        let token = data.map { String(format: "%02x", $0) }.joined()
        registeredToken = token
        Task { await registerWithBackend(token) }
    }

    private func registerWithBackend(_ token: String) async {
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif
        let appVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        let registration = DeviceRegistration(
            apnsToken: token,
            environment: environment,
            deviceModel: UIDevice.current.model,
            appVersion: appVersion,
            locale: Locale.current.identifier
        )
        try? await api.sendIgnoringBody(.registerDevice(registration))
    }
}
