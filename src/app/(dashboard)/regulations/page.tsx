import { RegulationsView } from "@/components/regulations/regulations-view";
import { dataService } from "@/server/services";

export default async function RegulationsPage() {
  return <RegulationsView rules={await dataService.getRegulations()} />;
}
