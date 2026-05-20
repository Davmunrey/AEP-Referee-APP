import Foundation
import Vision
import AppKit

let paths = Array(CommandLine.arguments.dropFirst())

for path in paths {
  guard
    let image = NSImage(contentsOfFile: path),
    let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
  else {
    continue
  }

  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  request.recognitionLanguages = ["es-ES", "en-US"]

  let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
  try? handler.perform([request])

  let lines = (request.results ?? [])
    .compactMap { $0.topCandidates(1).first?.string }

  print(lines.joined(separator: "\n"))
}
