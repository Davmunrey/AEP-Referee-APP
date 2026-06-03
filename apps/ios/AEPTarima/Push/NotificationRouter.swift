import Foundation
import Observation
import AEPTarimaCore

/// Pestañas de la pantalla principal (para el enrutado por push).
enum HomeTab: Hashable {
    case dashboard, competitions, referees, approvals, more
}

/// Estado de navegación que reacciona a las notificaciones push: traduce el
/// `type` del payload en la pestaña destino.
@MainActor
@Observable
final class NotificationRouter {
    var selectedTab: HomeTab = .dashboard

    func handle(userInfo: [AnyHashable: Any]) {
        guard let raw = userInfo["type"] as? String, let type = PushType(rawValue: raw) else { return }
        switch type {
        case .approvalPending:
            selectedTab = .approvals
        case .assignment:
            selectedTab = .competitions
        case .approvalApproved, .approvalRejected:
            selectedTab = .dashboard
        }
    }
}
