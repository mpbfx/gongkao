"use client";

import type { EChartsCoreOption } from "echarts/core";
import { useMemo } from "react";

import { EChart } from "@/components/charts/e-chart";
import type {
  AccuracyTrendPoint,
  KnowledgeTag,
  KnowledgeWeek,
  PracticeModeComparisonItem,
  WeakKnowledgeItem,
  WeeklyKnowledgeCell,
} from "@/server/services/learning-situation";

const ink = "#172238";
const mutedInk = "#626b73";
const paper = "#fbf8f1";
const rule = "#c8ced2";
const correction = "#d65a3a";
const success = "#2e7665";
const warning = "#b8842f";
const info = "#345b77";
const noData = "#ded9cf";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };

    return entities[character] ?? character;
  });
}

function tooltipBox(content: string) {
  return `<div style="min-width:150px;color:${ink};font-size:12px;line-height:1.65">${content}</div>`;
}

type EChartTooltipParam = {
  data?: unknown;
  dataIndex?: number;
  name?: string;
  seriesName?: string;
  value?: unknown;
};

function firstTooltipParam(value: unknown): EChartTooltipParam | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && typeof candidate === "object" ? candidate as EChartTooltipParam : null;
}

function chartLegend(items: Array<[string, string, string?]>) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-foreground/15 pt-1.5 text-[0.65rem] leading-4 text-muted-foreground">
      {items.map(([label, color, suffix]) => (
        <span key={label} className="inline-flex items-center gap-1">
          <span className="size-2.5 border border-foreground/15" style={{ backgroundColor: color }} aria-hidden="true" />
          {label}{suffix ? ` ${suffix}` : ""}
        </span>
      ))}
    </div>
  );
}

export function AccuracyTrendChart({ data }: { data: AccuracyTrendPoint[] }) {
  const option = useMemo<EChartsCoreOption>(() => ({
    animation: false,
    aria: { enabled: true, description: `最近 ${data.length} 次已提交练习的正确率折线图。` },
    grid: { top: 14, right: 14, bottom: 28, left: 40 },
    tooltip: {
      trigger: "axis",
      backgroundColor: paper,
      borderColor: ink,
      borderWidth: 1,
      formatter: (params: unknown) => {
        const param = firstTooltipParam(params);
        const point = typeof param?.dataIndex === "number" ? data[param.dataIndex] : null;
        return point ? tooltipBox(
          `<strong>${escapeHtml(point.title)}</strong><br/>${point.dateLabel} · ${point.modeLabel}<br/>` +
          `正确率 <strong>${point.accuracy.toFixed(2)}%</strong> · 已答 ${point.answeredCount}/${point.totalCount}`
        ) : "";
      },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.map((point) => point.dateLabel),
      axisLine: { lineStyle: { color: ink } },
      axisTick: { show: false },
      axisLabel: { color: mutedInk, fontSize: 10, interval: "auto", hideOverlap: true },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      interval: 25,
      axisLabel: { color: mutedInk, fontSize: 10, formatter: "{value}%" },
      splitLine: { lineStyle: { color: rule, type: "dashed" } },
    },
    series: [{
      type: "line",
      data: data.map((point) => point.accuracy),
      symbol: "circle",
      symbolSize: 6,
      showSymbol: true,
      lineStyle: { color: correction, width: 2.5 },
      itemStyle: { color: paper, borderColor: correction, borderWidth: 2 },
    }],
  }), [data]);

  return <EChart option={option} ariaLabel="最近练习正确率变化，数据摘要位于页面隐藏表格中。" className="h-[15rem] lg:h-[15.25rem]" />;
}

export function PracticeModeChart({ data }: { data: PracticeModeComparisonItem[] }) {
  const option = useMemo<EChartsCoreOption>(() => ({
    animation: false,
    aria: { enabled: true, description: "不同训练类型的累计题量和真实正确率对比。" },
    grid: { top: 24, right: 34, bottom: 28, left: 38 },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 7,
      textStyle: { color: mutedInk, fontSize: 10 },
      data: ["累计题量", "正确率"],
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: paper,
      borderColor: ink,
      borderWidth: 1,
      formatter: (params: unknown) => {
        const param = firstTooltipParam(params);
        const item = typeof param?.dataIndex === "number" ? data[param.dataIndex] : null;
        return item ? tooltipBox(
          `<strong>${escapeHtml(item.label)}</strong><br/>${item.sessionCount} 次 · ${item.totalQuestions} 题<br/>` +
          `正确 ${item.correctCount} · 错误 ${item.wrongCount} · 未答 ${item.unansweredCount}<br/>` +
          `正确率 <strong>${item.accuracy === null ? "—" : `${item.accuracy.toFixed(2)}%`}</strong>`
        ) : "";
      },
    },
    xAxis: {
      type: "category",
      data: data.map((item) => item.label),
      axisLine: { lineStyle: { color: ink } },
      axisTick: { show: false },
      axisLabel: { color: mutedInk, fontSize: 10, interval: 0 },
    },
    yAxis: [
      {
        type: "value",
        axisLabel: { color: mutedInk, fontSize: 9 },
        splitLine: { lineStyle: { color: rule, type: "dashed" } },
      },
      {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { color: mutedInk, fontSize: 9, formatter: "{value}%" },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "累计题量",
        type: "bar",
        data: data.map((item) => item.totalQuestions),
        barMaxWidth: 24,
        itemStyle: { color: info },
      },
      {
        name: "正确率",
        type: "line",
        yAxisIndex: 1,
        data: data.map((item) => item.accuracy),
        symbolSize: 6,
        lineStyle: { color: correction, width: 2 },
        itemStyle: { color: correction },
      },
    ],
  }), [data]);

  return <EChart option={option} ariaLabel="训练类型题量与正确率对比。" className="h-[13rem] lg:h-[6.5rem]" />;
}

export function AnswerCompositionChart({
  correctCount,
  wrongCount,
  unansweredCount,
}: {
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
}) {
  const values = [correctCount, wrongCount, unansweredCount];
  const total = values.reduce((sum, value) => sum + value, 0);
  const option = useMemo<EChartsCoreOption>(() => ({
    animation: false,
    aria: { enabled: true, description: `累计作答构成：正确 ${correctCount}，错误 ${wrongCount}，未答 ${unansweredCount}。` },
    grid: { top: 10, right: 2, bottom: 8, left: 2 },
    tooltip: {
      trigger: "item",
      backgroundColor: paper,
      borderColor: ink,
      borderWidth: 1,
      formatter: (params: unknown) => {
        const param = firstTooltipParam(params);
        const value = Number(param?.value ?? 0);
        return tooltipBox(`<strong>${escapeHtml(param?.seriesName ?? "作答")}</strong><br/>${value} 题 · ${total > 0 ? ((value / total) * 100).toFixed(2) : "0.00"}%`);
      },
    },
    xAxis: { type: "value", max: total || 1, show: false },
    yAxis: { type: "category", data: ["作答"], show: false },
    series: [
      { name: "正确", type: "bar", stack: "total", data: [correctCount], barWidth: 25, itemStyle: { color: success } },
      { name: "错误", type: "bar", stack: "total", data: [wrongCount], barWidth: 25, itemStyle: { color: correction } },
      { name: "未答", type: "bar", stack: "total", data: [unansweredCount], barWidth: 25, itemStyle: { color: noData, decal: { symbol: "rect", dashArrayX: [1, 0], dashArrayY: [3, 3], color: "rgba(23,34,56,.18)" } } },
    ],
  }), [correctCount, total, unansweredCount, wrongCount]);

  return (
    <div>
      <EChart option={option} ariaLabel="累计作答结果构成。" className="h-[3.25rem]" />
      {chartLegend([["正确", success, String(correctCount)], ["错误", correction, String(wrongCount)], ["未答", noData, String(unansweredCount)]])}
    </div>
  );
}

export function WrongResolutionChart({ resolvedCount, unresolvedCount }: { resolvedCount: number; unresolvedCount: number }) {
  const total = resolvedCount + unresolvedCount;
  const rate = total > 0 ? (resolvedCount / total) * 100 : 0;
  const option = useMemo<EChartsCoreOption>(() => ({
    animation: false,
    aria: { enabled: true, description: `错题已掌握 ${resolvedCount} 道，待复盘 ${unresolvedCount} 道。` },
    tooltip: {
      trigger: "item",
      backgroundColor: paper,
      borderColor: ink,
      borderWidth: 1,
      formatter: (params: unknown) => {
        const param = firstTooltipParam(params);
        const item = param?.data && typeof param.data === "object" ? param.data as { name?: string; value?: number } : null;
        return tooltipBox(`<strong>${escapeHtml(item?.name ?? "错题")}</strong><br/>${item?.value ?? 0} 道`);
      },
    },
    graphic: [{
      type: "group",
      left: "center",
      top: "middle",
      children: [
        { type: "text", left: "center", top: -13, style: { text: `${rate.toFixed(0)}%`, fill: ink, font: '600 22px "Songti SC", serif', textAlign: "center" } },
        { type: "text", left: "center", top: 13, style: { text: "已掌握", fill: mutedInk, font: '10px "PingFang SC", sans-serif', textAlign: "center" } },
      ],
    }],
    series: [{
      type: "pie",
      radius: ["60%", "82%"],
      center: ["50%", "50%"],
      label: { show: false },
      itemStyle: { borderColor: paper, borderWidth: 2 },
      data: [
        { name: "已掌握", value: resolvedCount, itemStyle: { color: success } },
        { name: "待复盘", value: unresolvedCount, itemStyle: { color: warning } },
      ],
    }],
  }), [rate, resolvedCount, unresolvedCount]);

  return <EChart option={option} ariaLabel="当前错题消化比例。" className="h-[7.5rem] lg:h-[4.5rem]" />;
}

export function KnowledgeHeatmapChart({ weeks, tags, cells }: { weeks: KnowledgeWeek[]; tags: KnowledgeTag[]; cells: WeeklyKnowledgeCell[] }) {
  const option = useMemo<EChartsCoreOption>(() => {
    const weekIndex = new Map(weeks.map((week, index) => [week.key, index]));
    const tagIndex = new Map(tags.map((tag, index) => [tag.id, index]));
    const heatmapData = cells.map((cell) => [weekIndex.get(cell.weekKey) ?? 0, tagIndex.get(cell.tagId) ?? 0, cell.accuracy ?? -1, cell.answeredCount, cell.correctCount, cell.sampleStatus, cell.tagName]);

    return {
      animation: false,
      aria: { enabled: true, description: `最近八个自然周、${tags.length} 个知识点的作答热力图。` },
      grid: { top: 4, right: 8, bottom: 38, left: 88 },
      tooltip: {
        position: "top",
        backgroundColor: paper,
        borderColor: ink,
        borderWidth: 1,
        formatter: (params: unknown) => {
          const param = firstTooltipParam(params);
          const values = Array.isArray(param?.data) ? param.data : [];
          const week = weeks[Number(values[0])];
          const accuracy = Number(values[2]);
          const answered = Number(values[3]);
          const correct = Number(values[4]);
          const tagName = String(values[6] ?? "未分类");
          return answered === 0
            ? tooltipBox(`<strong>${escapeHtml(tagName)}</strong><br/>${week?.rangeLabel ?? ""}<br/>无作答数据`)
            : tooltipBox(`<strong>${escapeHtml(tagName)}</strong><br/>${week?.rangeLabel ?? ""}<br/>正确率 <strong>${accuracy.toFixed(2)}%</strong> · ${correct}/${answered}`);
        },
      },
      xAxis: {
        type: "category",
        data: weeks.map((week) => week.label),
        axisLine: { lineStyle: { color: ink } },
        axisTick: { show: false },
        axisLabel: { color: mutedInk, fontSize: 9, rotate: 35, interval: 0, margin: 10 },
      },
      yAxis: {
        type: "category",
        data: tags.map((tag) => tag.name),
        axisLine: { lineStyle: { color: ink } },
        axisTick: { show: false },
        axisLabel: { color: ink, fontSize: 10, width: 75, overflow: "truncate", ellipsis: "…" },
      },
      visualMap: {
        type: "piecewise",
        show: false,
        dimension: 2,
        seriesIndex: 0,
        pieces: [
          { min: -1, max: -1, color: noData },
          { min: 0, max: 49.999, color: "#b8503d" },
          { min: 50, max: 69.999, color: "#c8953f" },
          { min: 70, max: 84.999, color: info },
          { min: 85, max: 100, color: success },
        ],
      },
      series: [{
        type: "heatmap",
        data: heatmapData,
        encode: { x: 0, y: 1, value: 2 },
        label: {
          show: true,
          fontSize: 9,
          rich: {
            dark: { color: ink, fontSize: 9 },
            light: { color: "#fffaf3", fontSize: 9 },
          },
          formatter: (params: unknown) => {
            const param = firstTooltipParam(params);
            const values = Array.isArray(param?.data) ? param.data : [];
            const accuracy = Number(values[2]);
            const limited = values[5] === "limited";
            if (accuracy < 0) return "{dark|—}";
            const style = accuracy >= 70 || accuracy < 50 ? "light" : "dark";
            return `{${style}|${Math.round(accuracy)}${limited ? "*" : ""}}`;
          },
        },
        itemStyle: { borderColor: paper, borderWidth: 2 },
      }],
    };
  }, [cells, tags, weeks]);

  return (
    <div>
      <EChart option={option} ariaLabel="近八周知识点作答热力图。" className="h-[20rem] lg:h-[12.75rem]" />
      {chartLegend([["无数据", noData], ["重点复盘", "#b8503d"], ["仍需校准", "#c8953f"], ["基本稳定", info], ["表现良好", success]])}
    </div>
  );
}

export function WeakKnowledgeChart({ data }: { data: WeakKnowledgeItem[] }) {
  const visible = data.slice(0, 6).toReversed();
  const option = useMemo<EChartsCoreOption>(() => ({
    animation: false,
    aria: { enabled: true, description: "当前待复盘知识点排行。" },
    grid: { top: 4, right: 116, bottom: 18, left: 84 },
    tooltip: {
      trigger: "item",
      backgroundColor: paper,
      borderColor: ink,
      borderWidth: 1,
      formatter: (params: unknown) => {
        const param = firstTooltipParam(params);
        const item = typeof param?.dataIndex === "number" ? visible[param.dataIndex] : null;
        return item ? tooltipBox(`<strong>${escapeHtml(item.tagName)}</strong><br/>待复盘 ${item.unresolvedCount} · 重复错误 ${item.highRepeatCount}<br/>历史正确率 ${item.accuracy === null ? "无数据" : `${item.accuracy.toFixed(2)}%（${item.correctCount}/${item.answeredCount}）`}`) : "";
      },
    },
    xAxis: { type: "value", show: false },
    yAxis: {
      type: "category",
      data: visible.map((item) => item.tagName),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: ink, fontSize: 10, width: 72, overflow: "truncate", ellipsis: "…" },
    },
    series: [{
      type: "bar",
      data: visible.map((item) => item.unresolvedCount),
      barWidth: 12,
      itemStyle: { color: warning },
      label: {
        show: true,
        position: "right",
        color: mutedInk,
        fontSize: 9,
        formatter: (params: unknown) => {
          const param = firstTooltipParam(params);
          const item = typeof param?.dataIndex === "number" ? visible[param.dataIndex] : null;
          return item ? `${item.unresolvedCount}题 / 重复${item.highRepeatCount} / ${item.accuracy === null ? "—" : `${Math.round(item.accuracy)}%`}` : "";
        },
      },
    }],
  }), [visible]);

  return <EChart option={option} ariaLabel="待复盘知识点排行，标签同时显示待复盘数、重复错误数和历史正确率。" className="h-[18rem] lg:h-[13.25rem]" />;
}
