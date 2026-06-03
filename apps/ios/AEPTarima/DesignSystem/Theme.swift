import SwiftUI

/// Tokens visuales de la app (espejo aproximado del design system web). Centra
/// el acento de marca y el mapeo de acentos de KPI / severidades de insight.
enum Theme {
    /// Acento principal de la marca AEP.
    static let accent = Color(hex: 0x2563EB)

    /// Color de un acento de KPI ("red" | "yellow" | "blue" | "neutral").
    static func kpiColor(_ accent: String) -> Color {
        switch accent {
        case "red": return .red
        case "yellow": return .orange
        case "blue": return accentBlue
        default: return .secondary
        }
    }

    /// Color de severidad de un insight.
    static func severityColor(_ severity: String) -> Color {
        switch severity {
        case "crítico": return .red
        case "alerta": return .orange
        case "sugerencia": return accentBlue
        default: return .green
        }
    }

    /// Color para el estado de salud operativa.
    static func healthColor(_ status: String) -> Color {
        switch status {
        case "óptimo": return .green
        case "estable": return accentBlue
        case "atención": return .orange
        default: return .red
        }
    }

    private static let accentBlue = Color(hex: 0x2563EB)
}

extension Color {
    /// Inicializa un color desde un entero hexadecimal 0xRRGGBB.
    init(hex: UInt32, alpha: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}
