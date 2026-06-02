import SwiftUI
import UIKit

/// Escanea un cuadrante/calendario con la cámara y genera un PDF, listo para
/// compartir o (en una iteración posterior) subir a los endpoints de import.
struct ScanView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var showScanner = false
    @State private var pageCount = 0
    @State private var pdfURL: URL?

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                if pageCount == 0 {
                    ContentUnavailableView {
                        Label("Escanear documento", systemImage: "doc.viewfinder")
                    } description: {
                        Text("Escanea un cuadrante o calendario; se generará un PDF.")
                    } actions: {
                        Button("Abrir cámara") { showScanner = true }
                            .buttonStyle(.borderedProminent)
                    }
                } else {
                    Image(systemName: "doc.fill").font(.system(size: 56)).foregroundStyle(.tint)
                    Text("\(pageCount) página(s) escaneada(s)").font(.headline)
                    if let pdfURL {
                        ShareLink(item: pdfURL) {
                            Label("Compartir PDF", systemImage: "square.and.arrow.up")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    Button("Escanear de nuevo") { showScanner = true }
                }
            }
            .padding()
            .navigationTitle("Escaneo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { dismiss() }
                }
            }
            .fullScreenCover(isPresented: $showScanner) {
                DocumentScannerView(
                    onComplete: { images in
                        pdfURL = Self.makePDF(from: images)
                        pageCount = images.count
                        showScanner = false
                    },
                    onCancel: { showScanner = false }
                )
                .ignoresSafeArea()
            }
        }
    }

    /// Compone las imágenes escaneadas en un PDF tamaño carta y devuelve su URL.
    static func makePDF(from images: [UIImage]) -> URL? {
        guard !images.isEmpty else { return nil }
        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("escaneo-\(UUID().uuidString).pdf")
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        do {
            try renderer.writePDF(to: url) { context in
                for image in images {
                    context.beginPage()
                    image.draw(in: pageRect)
                }
            }
            return url
        } catch {
            return nil
        }
    }
}
