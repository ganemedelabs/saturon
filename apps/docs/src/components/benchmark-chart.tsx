"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LabelList,
    Rectangle,
    type BarShapeProps,
} from "recharts";

export type BenchResult = {
    library: string;
    avg: number;
    perOp: number;
    vs: string;
};

export type BenchTask = {
    title: string;
    results: BenchResult[];
};

type Props = {
    tasks: BenchTask[];
    highlight?: string;
    log?: boolean;
};

const tick = { fill: "currentColor", fillOpacity: 0.7, fontSize: 12 };
const axisLine = { stroke: "currentColor", strokeOpacity: 0.2 };

const tooltipStyle = {
    background: "var(--color-fd-popover, var(--popover))",
    color: "var(--color-fd-popover-foreground, var(--popover-foreground))",
    border: "1px solid var(--color-fd-border, var(--border))",
    borderRadius: 8,
};

export function BenchmarkChart({ tasks, highlight = "Saturon", log = false }: Props) {
    return (
        <div className="grid gap-6 md:grid-cols-2">
            {tasks?.map((task) => {
                const rows = [...task.results].sort((a, b) => a.avg - b.avg);

                const BenchBar = (props: BarShapeProps) => (
                    <Rectangle
                        {...props}
                        radius={[0, 4, 4, 0]}
                        fill={
                            rows[props.index]?.library.startsWith(highlight)
                                ? "var(--color-fd-primary)"
                                : "alpha(from var(--color-fd-muted-foreground) / calc(alpha / 1.5))"
                        }
                    />
                );

                return (
                    <div key={task.title}>
                        <h3 className="mb-2 text-sm font-medium">{task.title}</h3>
                        <div className="h-60 w-full">
                            <ResponsiveContainer>
                                <BarChart
                                    data={rows}
                                    layout="vertical"
                                    margin={{ top: 0, right: 56, left: 8, bottom: 0 }}
                                >
                                    <CartesianGrid
                                        stroke="currentColor"
                                        strokeOpacity={0.15}
                                        strokeDasharray="3 3"
                                        horizontal={false}
                                    />
                                    <XAxis
                                        type="number"
                                        scale={log ? "log" : "linear"}
                                        domain={log ? [0.1, "auto"] : [0, "auto"]}
                                        allowDataOverflow={log}
                                        unit=" ms"
                                        tick={tick}
                                        axisLine={axisLine}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="library"
                                        width={110}
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
                                            const r = item.payload as BenchResult;
                                            return [`${value} ms (${r.perOp} µs/op) · ${r.vs}`, "Avg per 10k ops"];
                                        }}
                                    />
                                    <Bar dataKey="avg" shape={BenchBar}>
                                        <LabelList
                                            dataKey="avg"
                                            position="right"
                                            fontSize={11}
                                            fill="currentColor"
                                            formatter={(v) => `${v} ms`}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
