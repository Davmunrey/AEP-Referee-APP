import XCTest
@testable import AEPTarimaCore

/// Decodificación de los modelos de exámenes, ascensos, informes y normativa.
final class ModelsDecodingTests: XCTestCase {
    private let decoder = JSONDecoder()

    func testExamDecodes() throws {
        let json = """
        { "id": "ex1", "refereeId": "j1", "refereeName": "Ana", "tipo": "Ascenso IPF",
          "nivelObjetivo": "IPF Cat. 2", "fecha": "2026-05-01", "examinador": "Comité",
          "puntuacion": 88, "puntuacionMaxima": 100, "resultado": "Aprobado" }
        """.data(using: .utf8)!
        let exam = try decoder.decode(RefereeExam.self, from: json)
        XCTAssertEqual(exam.tipo, .ascensoIPF)
        XCTAssertEqual(exam.nivelObjetivo, .ipfCat2)
        XCTAssertEqual(exam.resultado, .aprobado)
        XCTAssertEqual(exam.puntuacion, 88)
        XCTAssertNil(exam.notas)
    }

    func testPromotionDecodes() throws {
        let json = """
        { "id": "p1", "refereeId": "j1", "refereeName": "Ana", "fromLevel": "Regional",
          "toLevel": "Nacional", "zona": "CENTRO", "status": "pendiente",
          "submittedAt": "2026-05-01T09:00:00Z", "eventosCompletados": 12 }
        """.data(using: .utf8)!
        let promo = try decoder.decode(PromotionRequest.self, from: json)
        XCTAssertEqual(promo.fromLevel, .regional)
        XCTAssertEqual(promo.toLevel, .nacional)
        XCTAssertEqual(promo.status, .pendiente)
        XCTAssertEqual(promo.eventosCompletados, 12)
    }

    func testReportDecodes() throws {
        let json = """
        { "id": "r1", "subjectType": "juez", "refereeId": "j1", "refereeName": "Ana",
          "titulo": "Evaluación", "tipo": "Evaluación", "contenido": "Buen desempeño",
          "autor": "Delegado" }
        """.data(using: .utf8)!
        let report = try decoder.decode(RefereeReport.self, from: json)
        XCTAssertEqual(report.subjectType, .juez)
        XCTAssertEqual(report.tipo, .evaluacion)
        XCTAssertNil(report.competitionId)
    }

    func testRegulationDecodes() throws {
        let json = """
        { "id": "reg1", "rol": "Central", "roleKey": "central", "minLevel": "Nacional",
          "eventTypes": ["AEP-1", "AEP-2"], "note": "Requiere nivel nacional" }
        """.data(using: .utf8)!
        let rule = try decoder.decode(RegulationRule.self, from: json)
        XCTAssertEqual(rule.minLevel, .nacional)
        XCTAssertEqual(rule.eventTypes, [.aep1, .aep2])
    }

    func testUnknownExamTypeIsTolerated() throws {
        let json = #"{ "data": "futuro_tipo" }"#.data(using: .utf8)!
        XCTAssertEqual(try decoder.decode(APISuccess<ExamType>.self, from: json).data, .unknown)
    }
}
