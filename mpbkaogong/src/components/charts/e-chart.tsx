"use client";

import { BarChart, HeatmapChart, LineChart, PieChart } from "echarts/charts";
import {
  AriaComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { init, use as registerEChartsModules, type ECharts, type EChartsCoreOption } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

registerEChartsModules([
  LineChart,
  BarChart,
  PieChart,
  HeatmapChart,
  GridComponent,
  GraphicComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  AriaComponent,
  SVGRenderer,
]);

export function EChart({
  option,
  ariaLabel,
  className,
  style,
}: {
  option: EChartsCoreOption;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const chart = init(container, undefined, { renderer: "svg" });
    const resizeObserver = new ResizeObserver(() => chart.resize());
    chartRef.current = chart;
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={cn("w-full", className)}
      style={style}
    />
  );
}
