import SwiftUI

/// Tokens visuales de la app — espejo del design system web (`src/styles/tokens.css`).
/// Fuente única de color/tipografía de marca AEP: tema claro profesional con
/// acento **rojo AEP** sobre neutros cálidos (escala *stone*).
enum Theme {
    // ── Marca / acción ──────────────────────────────────────────────────
    /// Acento principal AEP (rojo). `--primary` = `--aep-red-500`.
    static let accent       = Color(hex: 0xDC3F31)
    static let accentHover  = Color(hex: 0xC8362A)   // --aep-red-600
    static let accentSoft   = Color(hex: 0xE85D50)   // --aep-red-400
    static let accentSubtle = Color(hex: 0xFBE6E3)   // --aep-red-100

    // ── Neutros (escala cálida stone) ───────────────────────────────────
    static let background          = Color(hex: 0xFAF9F7)  // --neutral-50
    static let foreground          = Color(hex: 0x1C1916)  // --neutral-900
    static let foregroundSecondary = Color(hex: 0x46413A)  // --neutral-700
    static let subtle              = Color(hex: 0x837C72)  // --neutral-500
    static let subtleMuted         = Color(hex: 0xAAA399)  // --neutral-400
    static let card                = Color(hex: 0xFFFFFF)  // --card
    static let surface             = Color(hex: 0xF4F2EF)  // --neutral-100
    static let surfaceHover        = Color(hex: 0xEDEAE5)  // --neutral-150
    static let border              = Color(hex: 0xE3DFD8)  // --neutral-200
    static let borderStrong        = Color(hex: 0xD0CABF)  // --neutral-300

    // ── Estado ──────────────────────────────────────────────────────────
    static let success = Color(hex: 0x15924F)  // --aep-emerald-600
    static let warning = Color(hex: 0xC2790C)  // --aep-amber-600
    static let info    = Color(hex: 0x2563EB)  // --aep-blue-600
    static let danger  = Color(hex: 0xC8362A)  // --destructive

    /// Degradado de marca (`--gradient-brand-*`): neutral-900 → red-600 → amber-600.
    static let brandGradient = LinearGradient(
        colors: [Color(hex: 0x1C1916), Color(hex: 0xC8362A), Color(hex: 0xC2790C)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    // ── Mapeos de acento (KPI / severidad / salud) ──────────────────────
    /// Color de un acento de KPI ("red" | "yellow" | "blue" | "neutral").
    static func kpiColor(_ accent: String) -> Color {
        switch accent {
        case "red":    return Self.accent
        case "yellow": return warning
        case "blue":   return info
        default:       return subtle
        }
    }

    /// Color de severidad de un insight.
    static func severityColor(_ severity: String) -> Color {
        switch severity {
        case "crítico":    return danger
        case "alerta":     return warning
        case "sugerencia": return info
        default:           return success
        }
    }

    /// Color para el estado de salud operativa.
    static func healthColor(_ status: String) -> Color {
        switch status {
        case "óptimo":   return success
        case "estable":  return info
        case "atención": return warning
        default:         return danger
        }
    }
}

// ── Tipografía de marca: DM Sans (la misma que la web vía next/font) ────
extension Font {
    /// DM Sans escalable con Dynamic Type. La web usa DM Sans como `--font-sans`.
    static func aep(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom("DM Sans", size: size, relativeTo: style)
    }

    static let aepLargeTitle = Font.custom("DM Sans", size: 34, relativeTo: .largeTitle)
    static let aepTitle      = Font.custom("DM Sans", size: 22, relativeTo: .title)
    static let aepTitle2     = Font.custom("DM Sans", size: 18, relativeTo: .title2)
    static let aepHeadline   = Font.custom("DM Sans", size: 17, relativeTo: .headline)
    static let aepBody       = Font.custom("DM Sans", size: 17, relativeTo: .body)
    static let aepCallout    = Font.custom("DM Sans", size: 15, relativeTo: .callout)
    static let aepFootnote   = Font.custom("DM Sans", size: 13, relativeTo: .footnote)
    static let aepCaption    = Font.custom("DM Sans", size: 12, relativeTo: .caption)
}

extension Color {
    /// Inicializa un color desde un entero hexadecimal `0xRRGGBB`.
    init(hex: UInt32, alpha: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}
