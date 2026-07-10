"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip as RechartsTooltip,
} from "recharts";

interface TimeSeriesChartProps {
  data: Record<string, unknown>[];
  title: string;
  type?: "area" | "bar" | "line";
  dataKeys: { key: string; color: string; name?: string }[];
  height?: number;
  stacked?: boolean;
}

interface TooltipPayloadEntry {
  color: string;
  name: string;
  value: number | string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" });
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-background/90 backdrop-blur-md px-4 py-3 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
        {label ? formatDate(label) : ""}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry: TooltipPayloadEntry, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full ring-2 ring-background"
                style={{
                  backgroundColor: entry.color,
                  boxShadow: `0 0 8px ${entry.color}`,
                }}
              />
              <span className="text-muted-foreground/90 font-medium">{entry.name}</span>
            </div>
            <span className="font-bold text-foreground tabular-nums">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FormattedDataEntry extends Record<string, unknown> {
  formattedDate: string;
}

export function TimeSeriesChart({
  data,
  title,
  type = "area",
  dataKeys,
  height = 300,
  stacked = false,
}: TimeSeriesChartProps) {
  const [chartType, setChartType] = useState<"area" | "bar" | "line">(type);

  const formattedData: FormattedDataEntry[] = data.map((d) => ({
    ...d,
    formattedDate: typeof d.date === "string" ? formatDate(d.date) : "",
  }));

  const renderChart = () => {
    const commonProps = {
      data: formattedData,
      margin: { top: 15, right: 10, left: -20, bottom: 5 },
    };

    const commonAxisProps = {
      xAxis: (
        <XAxis
          dataKey="formattedDate"
          tick={{ fontSize: 10, fill: "var(--muted-foreground)", opacity: 0.6 }}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
      ),
      yAxis: (
        <YAxis
          tick={{ fontSize: 10, fill: "var(--muted-foreground)", opacity: 0.6 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          dx={-5}
        />
      ),
      grid: (
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          className="stroke-border/10"
        />
      ),
      tooltip: (
        <RechartsTooltip
          content={<CustomTooltip />}
          cursor={{ stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "3 3" }}
        />
      ),
      legend: (
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 16, fontWeight: 500 }}
          iconType="circle"
          iconSize={6}
        />
      ),
    };

    const glowFilter = (
      <filter id="chart-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    );

    if (chartType === "bar") {
      return (
        <BarChart {...commonProps}>
          <defs>
            {dataKeys.map((dk) => (
              <linearGradient
                key={dk.key}
                id={`gradient-bar-${dk.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={dk.color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={dk.color} stopOpacity={0.25} />
              </linearGradient>
            ))}
          </defs>
          {commonAxisProps.grid}
          {commonAxisProps.xAxis}
          {commonAxisProps.yAxis}
          {commonAxisProps.tooltip}
          {commonAxisProps.legend}
          {dataKeys.map((dk) => (
            <Bar
              key={dk.key}
              dataKey={dk.key}
              name={dk.name || dk.key}
              fill={`url(#gradient-bar-${dk.key})`}
              radius={stacked ? [3, 3, 0, 0] : [5, 5, 0, 0]}
              maxBarSize={24}
              stackId={stacked ? "stack" : undefined}
              activeBar={{ fillOpacity: 0.85, stroke: dk.color, strokeWidth: 1 }}
              animationDuration={800}
            />
          ))}
        </BarChart>
      );
    }

    if (chartType === "line") {
      return (
        <LineChart {...commonProps}>
          <defs>{glowFilter}</defs>
          {commonAxisProps.grid}
          {commonAxisProps.xAxis}
          {commonAxisProps.yAxis}
          {commonAxisProps.tooltip}
          {commonAxisProps.legend}
          {dataKeys.map((dk) => (
            <Line
              key={dk.key}
              type="monotone"
              dataKey={dk.key}
              name={dk.name || dk.key}
              stroke={dk.color}
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, stroke: dk.color, fill: "var(--background)" }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff", fill: dk.color }}
              style={{ filter: "url(#chart-glow)" }}
              animationDuration={1000}
            />
          ))}
        </LineChart>
      );
    }

    // Default: area
    return (
      <AreaChart {...commonProps}>
        <defs>
          {glowFilter}
          {dataKeys.map((dk) => (
            <linearGradient
              key={dk.key}
              id={`gradient-area-${dk.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={dk.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={dk.color} stopOpacity={0.0} />
            </linearGradient>
          ))}
        </defs>
        {commonAxisProps.grid}
        {commonAxisProps.xAxis}
        {commonAxisProps.yAxis}
        {commonAxisProps.tooltip}
        {commonAxisProps.legend}
        {dataKeys.map((dk) => (
          <Area
            key={dk.key}
            type="monotone"
            dataKey={dk.key}
            name={dk.name || dk.key}
            stroke={dk.color}
            strokeWidth={3}
            fill={`url(#gradient-area-${dk.key})`}
            stackId={stacked ? "stack" : undefined}
            dot={{ r: 3, strokeWidth: 2, stroke: dk.color, fill: "var(--background)" }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff", fill: dk.color }}
            style={{ filter: "url(#chart-glow)" }}
            animationDuration={1000}
          />
        ))}
      </AreaChart>
    );
  };

  return (
    <div className="group relative rounded-2xl border border-border/50 bg-gradient-to-br from-card to-card/40 p-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:border-border/90 hover:shadow-xl">
      <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <h3 className="mb-5 text-sm font-semibold tracking-tight text-foreground/90 flex items-center justify-between">
        <span>{title}</span>
        <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-muted/20 p-0.5 z-10">
          {(["area", "bar", "line"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setChartType(t)}
              className={`text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-md transition-all duration-200 ${
                chartType === t
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
