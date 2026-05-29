import { miscApi } from "./client-misc";
import { refereeApi } from "./client-referees";
import { competitionApi } from "./client-competitions";
import { rosterApi } from "./client-roster";
import { adminApi } from "./client-admin";

// Nota: el login/logout se gestiona directamente con el cliente Supabase
// en /sign-in y el sidebar — no hay método de API REST para auth.
export const api = {
  ...miscApi,
  ...refereeApi,
  ...competitionApi,
  ...rosterApi,
  ...adminApi,
};
