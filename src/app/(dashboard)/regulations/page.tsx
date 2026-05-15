import { RegulationsView } from "@/components/regulations/regulations-view";
import { dataService } from "@/server/services";

export default function RegulationsPage() {
  return <RegulationsView rules={dataService.getRegulations()} />;
}
