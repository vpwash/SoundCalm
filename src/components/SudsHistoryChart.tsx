import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { SessionLog } from '../types.ts';
import { getRecentSudsImprovementSeries, SudsImprovementPoint } from '../utils/clinical.ts';
import { TrendingDown, Calendar } from 'lucide-react';

interface SudsHistoryChartProps {
  sessions: SessionLog[];
  title?: string;
  compact?: boolean;
}

export const SudsHistoryChart: React.FC<SudsHistoryChartProps> = ({
  sessions,
  title = 'SUDS Improvement (Last 7 Sessions)',
  compact = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(420);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const series = useMemo(() => getRecentSudsImprovementSeries(sessions, 7), [sessions]);

  const avgImprovement = useMemo(() => {
    if (series.length === 0) return 0;
    const sum = series.reduce((acc, pt) => acc + pt.improvement, 0);
    return Number((sum / series.length).toFixed(1));
  }, [series]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 120) {
          setChartWidth(Math.round(entry.contentRect.width));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || series.length === 0) return;

    const width = Math.max(260, chartWidth);
    const height = compact ? 156 : 188;
    const margin = { top: 18, right: 18, bottom: 32, left: 32 };
    const innerWidth = Math.max(120, width - margin.left - margin.right);
    const innerHeight = Math.max(80, height - margin.top - margin.bottom);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const defs = svg.append('defs');
    const areaGrad = defs
      .append('linearGradient')
      .attr('id', 'suds-improvement-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#38BDF8').attr('stop-opacity', 0.22);
    areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#10B981').attr('stop-opacity', 0.28);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scalePoint<string>()
      .domain(series.map((d) => d.label))
      .range([series.length === 1 ? innerWidth / 2 : 14, series.length === 1 ? innerWidth / 2 : innerWidth - 14])
      .padding(0.2);

    const yScale = d3.scaleLinear().domain([0, 10]).range([innerHeight, 0]);

    // Horizontal SUDS reference grid lines
    const yTicks = [0, 2, 4, 6, 8, 10];
    g.selectAll('.grid-line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#334155')
      .attr('stroke-opacity', (d) => (d === 0 || d === 5 || d === 10 ? 0.85 : 0.4))
      .attr('stroke-dasharray', (d) => (d === 0 ? 'none' : '3 3'));

    // Y-axis numeric labels
    g.selectAll('.y-label')
      .data([0, 5, 10])
      .enter()
      .append('text')
      .attr('x', -8)
      .attr('y', (d) => yScale(d) + 3.5)
      .attr('text-anchor', 'end')
      .attr('fill', '#94A3B8')
      .attr('font-size', '10px')
      .attr('font-family', 'ui-monospace, monospace')
      .text((d) => String(d));

    // Shaded improvement ribbon between Pre-SUDS and Post-SUDS
    if (series.length >= 2) {
      const ribbon = d3
        .area<SudsImprovementPoint>()
        .x((d) => xScale(d.label) ?? 0)
        .y0((d) => yScale(Math.max(d.preSuds, d.postSuds)))
        .y1((d) => yScale(Math.min(d.preSuds, d.postSuds)))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(series)
        .attr('fill', 'url(#suds-improvement-grad)')
        .attr('d', ribbon);

      // Pre-SUDS dashed baseline curve
      const preLine = d3
        .line<SudsImprovementPoint>()
        .x((d) => xScale(d.label) ?? 0)
        .y((d) => yScale(d.preSuds))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(series)
        .attr('fill', 'none')
        .attr('stroke', '#38BDF8')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4 3')
        .attr('d', preLine);

      // Post-SUDS solid outcome curve
      const postLine = d3
        .line<SudsImprovementPoint>()
        .x((d) => xScale(d.label) ?? 0)
        .y((d) => yScale(d.postSuds))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(series)
        .attr('fill', 'none')
        .attr('stroke', '#34D399')
        .attr('stroke-width', 2.5)
        .attr('d', postLine);
    }

    // Per-session Pre->Post vertical improvement segments, points, labels & hover targets
    const pointsGroup = g
      .selectAll('.session-point')
      .data(series)
      .enter()
      .append('g')
      .attr('class', 'session-point')
      .style('cursor', 'pointer');

    // Vertical improvement drop line
    pointsGroup
      .append('line')
      .attr('x1', (d) => xScale(d.label) ?? 0)
      .attr('x2', (d) => xScale(d.label) ?? 0)
      .attr('y1', (d) => yScale(d.preSuds))
      .attr('y2', (d) => yScale(d.postSuds))
      .attr('stroke', (d) => (d.improvement >= 0 ? '#10B981' : '#F43F5E'))
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round')
      .attr('stroke-opacity', 0.85);

    // Pre-SUDS open ring marker
    pointsGroup
      .append('circle')
      .attr('cx', (d) => xScale(d.label) ?? 0)
      .attr('cy', (d) => yScale(d.preSuds))
      .attr('r', 4.5)
      .attr('fill', '#0F172A')
      .attr('stroke', '#38BDF8')
      .attr('stroke-width', 2);

    // Post-SUDS solid emerald/rose marker
    pointsGroup
      .append('circle')
      .attr('cx', (d) => xScale(d.label) ?? 0)
      .attr('cy', (d) => yScale(d.postSuds))
      .attr('r', 5)
      .attr('fill', (d) => (d.improvement >= 0 ? '#34D399' : '#FB7185'))
      .attr('stroke', '#0F172A')
      .attr('stroke-width', 1.5);

    // Improvement badge above highest point of each session
    pointsGroup
      .append('text')
      .attr('x', (d) => xScale(d.label) ?? 0)
      .attr('y', (d) => Math.max(8, yScale(Math.max(d.preSuds, d.postSuds)) - 7))
      .attr('text-anchor', 'middle')
      .attr('fill', (d) => (d.improvement > 0 ? '#34D399' : d.improvement < 0 ? '#FB7185' : '#94A3B8'))
      .attr('font-size', '9.5px')
      .attr('font-weight', '700')
      .attr('font-family', 'ui-monospace, monospace')
      .text((d) => (d.improvement > 0 ? `-${d.improvement}` : d.improvement < 0 ? `+${Math.abs(d.improvement)}` : '0'));

    // X-axis session labels (#1 .. #7 & short date)
    pointsGroup
      .append('text')
      .attr('x', (d) => xScale(d.label) ?? 0)
      .attr('y', innerHeight + 16)
      .attr('text-anchor', 'middle')
      .attr('fill', '#CBD5E1')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .text((d) => d.label);

    pointsGroup
      .append('text')
      .attr('x', (d) => xScale(d.label) ?? 0)
      .attr('y', innerHeight + 27)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748B')
      .attr('font-size', '8.5px')
      .text((d) => {
        const dt = new Date(d.timestamp);
        return Number.isNaN(dt.getTime())
          ? ''
          : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      });

    // Invisible wide hit area for smooth touch & mouse inspection
    pointsGroup
      .append('rect')
      .attr('x', (d) => (xScale(d.label) ?? 0) - 18)
      .attr('y', 0)
      .attr('width', 36)
      .attr('height', innerHeight + 28)
      .attr('fill', 'transparent')
      .on('mouseenter touchstart', (_event, d) => {
        setActiveIndex(d.index - 1);
      })
      .on('mouseleave', () => {
        setActiveIndex(null);
      });
  }, [series, chartWidth, compact]);

  const highlightedPoint =
    activeIndex !== null && series[activeIndex]
      ? series[activeIndex]
      : series.length > 0
      ? series[series.length - 1]
      : null;

  return (
    <div
      ref={containerRef}
      className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/85 border border-slate-800 text-left space-y-2.5"
    >
      {/* Header & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TrendingDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <h4 className="text-[11px] sm:text-xs font-bold text-slate-100 uppercase tracking-wider">
            {title}
          </h4>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[10px] sm:text-[11px]">
          <span className="flex items-center gap-1 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-sky-400 bg-slate-950 inline-block" />
            <span>Pre</span>
          </span>
          <span className="flex items-center gap-1 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            <span>Post</span>
          </span>
          {series.length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full font-bold border ${
                avgImprovement > 0
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : avgImprovement < 0
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {avgImprovement > 0
                ? `Avg -${avgImprovement} SUDS`
                : avgImprovement < 0
                ? `Avg +${Math.abs(avgImprovement)} SUDS`
                : 'Avg 0 SUDS'}
            </span>
          )}
        </div>
      </div>

      {/* D3 SVG Canvas */}
      {series.length === 0 ? (
        <div className="h-36 flex flex-col items-center justify-center text-slate-500 text-xs text-center px-4">
          <Calendar className="w-7 h-7 mb-1.5 opacity-50" />
          <span>No historical sessions yet. Complete your first session to visualize SUDS improvement.</span>
        </div>
      ) : (
        <>
          <div className="w-full overflow-hidden">
            <svg
              ref={svgRef}
              role="img"
              aria-label="D3 chart showing historical SUDS improvement over the last 7 sessions"
              className="w-full h-auto block select-none"
            />
          </div>

          {highlightedPoint && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-teal-300">Session {highlightedPoint.label}</span>
                <span className="truncate text-slate-200">{highlightedPoint.triggerName}</span>
              </div>
              <div className="flex items-center gap-2.5 font-mono shrink-0">
                <span className="text-sky-300">Pre {highlightedPoint.preSuds}</span>
                <span className="text-slate-500">→</span>
                <span className="text-emerald-300">Post {highlightedPoint.postSuds}</span>
                <span
                  className={`font-bold ${
                    highlightedPoint.improvement > 0
                      ? 'text-emerald-400'
                      : highlightedPoint.improvement < 0
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  ({highlightedPoint.improvement > 0
                    ? `-${highlightedPoint.improvement} improved`
                    : highlightedPoint.improvement < 0
                    ? `+${Math.abs(highlightedPoint.improvement)}`
                    : 'Steady'})
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
