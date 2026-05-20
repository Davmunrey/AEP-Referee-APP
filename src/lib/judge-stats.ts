import { isSanctionActive } from "@/lib/sanctions";
import type {
  JudgeProfile,
  Referee,
  RefereeCompetitionHistoryItem,
  RefereeExam,
  RefereeReport,
  RefereeSanction,
} from "@/lib/types";

/** Combina juez + exámenes + informes + sanciones en un perfil con métricas. */
export function computeJudgeProfile(
  referee: Referee,
  exams: RefereeExam[],
  reports: RefereeReport[],
  sanctions: RefereeSanction[] = [],
  competitionHistory: RefereeCompetitionHistoryItem[] = [],
): JudgeProfile {
  const sortedExams = [...exams].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const sortedReports = [...reports].sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );
  const passed = exams.filter((e) => e.resultado === "Aprobado").length;
  const scored = exams.filter((e) => typeof e.puntuacion === "number");
  const avgScore = scored.length
    ? Math.round(
        scored.reduce((acc, e) => acc + (e.puntuacion ?? 0), 0) / scored.length,
      )
    : null;
  const sortedSanctions = [...sanctions].sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );
  const activeSanction = sortedSanctions.find((s) => isSanctionActive(s));

  return {
    referee,
    exams: sortedExams,
    reports: sortedReports,
    sanctions: sortedSanctions,
    activeSanction,
    competitionHistory: [...competitionHistory].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    examsPassed: passed,
    examsTotal: exams.length,
    avgScore,
    lastExam: sortedExams[0],
  };
}
