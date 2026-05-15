import { jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

export async function GET() {
  return jsonOk(dataService.getRegulations());
}
