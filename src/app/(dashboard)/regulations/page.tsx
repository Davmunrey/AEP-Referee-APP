import { RegulationsView } from "@/components/regulations/regulations-view";
import { dataService } from "@/server/services";

export default async function RegulationsPage() {
  const rules = await dataService.getRegulations();
  return <RegulationsView rules={rules} />;
}
