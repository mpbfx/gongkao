"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DistributionItem = {
  cause: string;
  label: string;
  count: number;
};

type TrendItem = {
  day: string;
  total: number;
  movingAverage: number;
  [key: string]: number | string;
};

type KnowledgePattern = {
  tagId: string | null;
  tagName: string;
  cause: string;
  label: string;
  count: number;
};

const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function tooltipStyle() {
  return {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--foreground)",
  };
}

export function MistakeTrendChart({ data }: { data: TrendItem[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="day" tick={{ fontSize: 12 }} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={tooltipStyle()} />
          <Legend />
          <Line type="monotone" dataKey="total" name="复盘次数" stroke={chartColors[0]} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="movingAverage" name="7日均线" stroke={chartColors[1]} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MistakeDistributionChart({ data }: { data: DistributionItem[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, bottom: 0, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="label" width={96} tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={tooltipStyle()} />
          <Bar dataKey="count" name="题数" fill={chartColors[2]} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KnowledgePatternMatrix({ data }: { data: KnowledgePattern[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无知识点错因模式。完成更多错题复盘后，这里会显示高频组合。</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((item, index) => (
        <div key={`${item.tagId ?? "untagged"}-${item.cause}`} className="rounded-lg border bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{item.tagName}</div>
              <div className="mt-1 text-xs text-muted-foreground">{item.label}</div>
            </div>
            <div
              className="grid size-9 shrink-0 place-items-center rounded-lg font-mono text-sm font-semibold text-white"
              style={{ backgroundColor: chartColors[index % chartColors.length] }}
            >
              {item.count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
