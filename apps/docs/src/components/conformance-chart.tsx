"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";

type Metric = "valid" | "invalid" | "computed";

type Row = {
    name: string;
    valid: number;
    invalid: number;
    computed: number;
    counts: Record<Metric, string>;
};

const metrics: { key: Metric; label: string; color: string }[] = [
    { key: "valid", label: "Valid accepted", color: "var(--chart-valid)" },
    { key: "invalid", label: "Invalid rejected", color: "var(--chart-invalid)" },
    { key: "computed", label: "Computed match", color: "var(--chart-computed)" },
];

const tick = { fill: "currentColor", fillOpacity: 0.7, fontSize: 12 };
const axisLine = { stroke: "currentColor", strokeOpacity: 0.2 };

const tooltipStyle = {
    background: "var(--color-fd-popover, var(--popover))",
    color: "var(--color-fd-popover-foreground, var(--popover-foreground))",
    border: "1px solid var(--color-fd-border, var(--border))",
    borderRadius: 8,
};

export function ConformanceChart({ data }: { data: Row[] }) {
    return (
        <div className="h-105 w-full">
            <ResponsiveContainer>
                <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={tick} axisLine={axisLine} tickLine={false} />
                    <YAxis
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={tick}
                        axisLine={axisLine}
                        tickLine={false}
                    />
                    <Tooltip
                        cursor={{ fill: "currentColor", fillOpacity: 0.08 }}
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "inherit" }}
                        itemStyle={{ color: "inherit" }}
                        formatter={(value, _name, item) => {
                            const row = item.payload as Row;
                            const counts = row.counts[item.dataKey as Metric];
                            return `${value}% (${counts})`;
                        }}
                    />
                    <Legend
                        formatter={(v) => (
                            <span style={{ color: "var(--color-fd-foreground, var(--foreground))" }}>{v}</span>
                        )}
                    />
                    {metrics.map((m) => (
                        <Bar key={m.key} dataKey={m.key} name={m.label} fill={m.color} radius={[4, 4, 0, 0]}>
                            <LabelList
                                dataKey={m.key}
                                position="top"
                                fontSize={10}
                                fill="currentColor"
                                formatter={(v) => `${v}%`}
                            />
                        </Bar>
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
