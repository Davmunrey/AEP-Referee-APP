import type {
  JudgeProfile,
  Referee,
  RefereeExam,
  RefereeReport,
} from "@/lib/types";

/** Combina árbitro + exámenes + informes en un perfil con métricas. */
export function computeJudgeProfile(
  referee: Referee,
  exams: RefereeExam[],
  reports: RefereeReport[],
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
  return {
    referee,
    exams: sortedExams,
    reports: sortedReports,
    examsPassed: passed,
    examsTotal: exams.length,
    avgScore,
    lastExam: sortedExams[0],
  };
}
