import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type ChartItem = {
  name: string;
  value: number;
};

export default function TownCompletionChart({ data, colors }: { data: ChartItem[]; colors: string[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={48} dataKey="value" strokeWidth={0}>
          {data.map((_, index) => <Cell key={index} fill={colors[index]} />)}
        </Pie>
        <Tooltip formatter={(value: number) => [`${value} 项`, ""]} contentStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
