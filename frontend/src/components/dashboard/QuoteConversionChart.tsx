import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function QuoteConversionChart({
  data,
}: {
  data: { label: string; total: number; converted: number; rate: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quote conversion rate</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--fg-muted)", fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--fg-muted)", fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
                width={36}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, _name, item: any) => [
                  `${value}% (${item.payload.converted}/${item.payload.total})`,
                  "Conversion rate",
                ]}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="var(--color-brand-600)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--color-brand-600)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
