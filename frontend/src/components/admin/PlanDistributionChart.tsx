import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const PLAN_COLORS: Record<string, string> = {
  STARTER: "#9ca3af",
  PROFESSIONAL: "#4f46e5",
  BUSINESS: "#22c55e",
};

const PLAN_LABEL: Record<string, string> = {
  STARTER: "Starter",
  PROFESSIONAL: "Professional",
  BUSINESS: "Business",
};

export function PlanDistributionChart({ data }: { data: { plan: string; count: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="plan" innerRadius={55} outerRadius={75} paddingAngle={2}>
                {data.map((entry) => (
                  <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan] ?? "#9ca3af"} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-fg">{total}</span>
            <span className="text-xs text-fg-muted">Tenants</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2">
          {data.map((entry) => (
            <div key={entry.plan} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PLAN_COLORS[entry.plan] ?? "#9ca3af" }} />
              <span className="text-fg-secondary">{PLAN_LABEL[entry.plan] ?? entry.plan}</span>
              <span className="ml-auto font-medium text-fg">{entry.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
