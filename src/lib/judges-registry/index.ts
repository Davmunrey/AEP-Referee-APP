export {
  parseJudgesRegistryXlsx,
  inicialesFromNombre,
  type ParsedJudgesRegistry,
  type ParsedRegistryCompetition,
  type ParsedRegistryReferee,
} from "./parse-xlsx";
export {
  mapExcelZone,
  mapExcelLevel,
  mapExcelActivo,
  refereeIdFromExcelId,
} from "./maps";
export { parseCampeonatosCsv } from "./parse-csv";
export type { RefereeArbitrajeStats } from "./arbitraje-stats";
export { topArbitrajeRoles, ARBITRAJE_ROLE_LABELS } from "./arbitraje-stats";
