import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#9ca3af",
  SENT: "#3b82f6",
  VIEWED: "#818cf8",
  PAID: "#22c55e",
  OVERDUE: "#ef4444",
  CANCELLED: "#6b7280",
};

export function StatusDonut({ statusCounts }: { statusCounts: Record<string, number> }) {
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const data = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="status" innerRadius={55} outerRadius={75} paddingAngle={2}>
                {data.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#9ca3af"} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-fg">{total}</span>
            <span className="text-xs text-fg-muted">Total</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {data.map((entry) => (
            <div key={entry.status} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[entry.status] ?? "#9ca3af" }}
              />
              <span className="capitalize text-fg-secondary">{entry.status.toLowerCase()}</span>
              <span className="ml-auto font-medium text-fg">{entry.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
