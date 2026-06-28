import { Analytics } from "../../../widgets/(Main)/Analytics";
import { RecentRevenue } from "../../../widgets/(Main)/RecentRevenue";

export const DashboardPage = () => {
  return (
    <div className="space-y-6 pb-8">
      <Analytics />
      <RecentRevenue />
    </div>
  );
};
