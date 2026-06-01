import Foundation

/// Cuerpo de POST /api/v1/devices para registrar el token APNs del dispositivo.
public struct DeviceRegistration: Codable, Sendable {
    public var apnsToken: String
    public var environment: String   // "sandbox" | "production"
    public var deviceModel: String?
    public var appVersion: String?
    public var locale: String?

    public init(
        apnsToken: String, environment: String, deviceModel: String? = nil,
        appVersion: String? = nil, locale: String? = nil
    ) {
        self.apnsToken = apnsToken; self.environment = environment
        self.deviceModel = deviceModel; self.appVersion = appVersion; self.locale = locale
    }
}

/// Tipos de notificación que emite el backend (campo `type` del payload APNs),
/// usados por el cliente para enrutar el deep-link al recibir la push.
public enum PushType: String, Sendable {
    case approvalPending = "approval_pending"
    case approvalApproved = "approval_approved"
    case approvalRejected = "approval_rejected"
    case assignment = "assignment"
}
