import type { ReactNode } from "react";

import { ReportNavigation } from "@/components/report-navigation";

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2">
      <ReportNavigation />
      {children}
    </div>
  );
}
