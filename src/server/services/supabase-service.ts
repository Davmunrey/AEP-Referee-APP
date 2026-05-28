import type { SessionUser, SlotFlags } from "@/lib/types";
import { analyticsService } from "./supabase-analytics";
import { competitionService } from "./supabase-competitions";
import { examsService } from "./supabase-exams";
import { refereeService } from "./supabase-referees";
import { rosterService } from "./supabase-roster";

export const supabaseDataService = {
  // ── Meta / Analytics ─────────────────────────────────────────────────────
  getMeta: analyticsService.getMeta,
  getDashboard: analyticsService.getDashboard,
  getAnalytics: analyticsService.getAnalytics,
  getRegulations: analyticsService.getRegulations,

  // ── Referees ──────────────────────────────────────────────────────────────
  getReferees: refereeService.getReferees,
  getReferee: refereeService.getReferee,
  createReferee: refereeService.createReferee,
  updateReferee: refereeService.updateReferee,
  deleteReferee: refereeService.deleteReferee,
  getJudgeProfile: (id: string) =>
    refereeService.getJudgeProfile(id, examsService.getExams, examsService.getReports),

  // Sanctions (re-exported from refereeService)
  listRefereeSanctions: refereeService.listRefereeSanctions,
  getActiveSanction: refereeService.getActiveSanction,
  createRefereeSanction: refereeService.createRefereeSanction,
  revokeRefereeSanction: refereeService.revokeRefereeSanction,
  markSanctionDelegateNotified: refereeService.markSanctionDelegateNotified,
  getSanctionAlerts: refereeService.getSanctionAlerts,
  expireStaleSanctions: refereeService.expireStaleSanctions,

  // ── Competitions ──────────────────────────────────────────────────────────
  getCompetitions: competitionService.getCompetitions,
  getCompetition: competitionService.getCompetition,
  createCompetition: competitionService.createCompetition,
  updateCompetition: competitionService.updateCompetition,
  deleteCompetition: competitionService.deleteCompetition,
  getCompetitionAvailability: competitionService.getCompetitionAvailability,
  addCompetitionAvailability: competitionService.addCompetitionAvailability,
  removeCompetitionAvailability: competitionService.removeCompetitionAvailability,
  findCompetitionDuplicates: (user?: SessionUser) =>
    competitionService.findCompetitionDuplicates(competitionService.getCompetitions, user),
  removeDuplicateCompetitions: (user?: SessionUser) =>
    competitionService.removeDuplicateCompetitions(
      competitionService.getCompetitions,
      competitionService.deleteCompetition,
      user,
    ),

  // ── Roster ────────────────────────────────────────────────────────────────
  getRoster: (competitionId: string) =>
    rosterService.getRoster(competitionId, competitionService.getCompetition),
  saveCompetitionTemplate: (competitionId: string, template: import("@/lib/types").RosterSession[], actor: string) =>
    rosterService.saveCompetitionTemplate(competitionId, template, actor, competitionService.getCompetition),
  setSlotFlags: rosterService.setSlotFlags,
  validateAssign: (competitionId: string, slotKey: string, refereeId: string) =>
    rosterService.validateAssign(competitionId, slotKey, refereeId, competitionService.getCompetition, refereeService.getReferee),
  assignReferee: (
    competitionId: string,
    slotKey: string,
    refereeId: string,
    actor: string,
    slotFlags?: SlotFlags,
    crossZoneReason?: string,
  ) =>
    rosterService.assignReferee(
      competitionId,
      slotKey,
      refereeId,
      actor,
      competitionService.getCompetition,
      refereeService.getReferee,
      (cId, sKey, rId) =>
        rosterService.validateAssign(cId, sKey, rId, competitionService.getCompetition, refereeService.getReferee),
      slotFlags,
      crossZoneReason,
    ),
  clearSlot: rosterService.clearSlot,
  clearRosterAssignments: (competitionId: string, actor: string) =>
    rosterService.clearRosterAssignments(competitionId, actor, competitionService.getCompetition),
  submitRoster: (competitionId: string, actor: string) =>
    rosterService.submitRoster(competitionId, actor, competitionService.getCompetition),
  saveDraft: (competitionId: string, actor: string) =>
    rosterService.saveDraft(competitionId, actor, competitionService.getCompetition),
  getApprovals: rosterService.getApprovals,
  reviewApproval: (id: string, approve: boolean, reviewer: string, comment?: string) =>
    rosterService.reviewApproval(id, approve, reviewer, competitionService.getCompetition, comment),
  getRosterHistory: rosterService.getRosterHistory,
  exportRoster: (competitionId: string) =>
    rosterService.exportRoster(
      competitionId,
      (cId) => rosterService.getRoster(cId, competitionService.getCompetition),
      competitionService.getCompetition,
    ),
  getNavCounts: (user?: SessionUser) =>
    rosterService.getNavCounts(user, competitionService.getCompetitions, rosterService.getApprovals),

  // ── Exams / Reports / Promotions ──────────────────────────────────────────
  getExams: examsService.getExams,
  createExam: examsService.createExam,
  updateExam: examsService.updateExam,
  deleteExam: examsService.deleteExam,
  getReport: examsService.getReport,
  getReports: examsService.getReports,
  createReport: examsService.createReport,
  updateReport: examsService.updateReport,
  deleteReport: examsService.deleteReport,
  getPromotions: examsService.getPromotions,
  reviewPromotion: examsService.reviewPromotion,
  createPromotion: examsService.createPromotion,
  importJudgesRegistry: examsService.importJudgesRegistry,
};
