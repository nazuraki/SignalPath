import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WorkstreamPair } from '../../../shared/types.ts';
import { buildCombinedSeries, EPIC_COLORS } from '../lib/burndown.ts';
import { fmt1 } from '../lib/format.ts';
import { useIsDark } from '../lib/theme.ts';

interface Props {
  pairs: WorkstreamPair[];
  activeWorkstream: string | null;
}

export default function CombinedChart({ pairs, activeWorkstream }: Props) {
  const dark = useIsDark();
  const series = buildCombinedSeries(pairs);

  const gridColor = dark ? '#1f1f23' : '#e0e0e8';
  const axisColor = dark ? '#52525b' : '#8888a0';
  const tooltipBg = dark ? '#0c0c0d' : '#ffffff';
  const tooltipBorder = dark ? '#2a2a2e' : '#c8c8d4';
  const tooltipLabel = dark ? '#a3a3a3' : '#606070';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={series} margin={{ top: 10, right: 28, left: 8, bottom: 8 }}>
        <CartesianGrid stroke={gridColor} strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="label"
          stroke={axisColor}
          fontSize={10}
          tick={{ fontFamily: 'JetBrains Mono, monospace' }}
          interval="preserveStartEnd"
          minTickGap={60}
        />
        <YAxis
          stroke={axisColor}
          fontSize={10}
          tick={{ fontFamily: 'JetBrains Mono, monospace' }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
          }}
          labelStyle={{ color: tooltipLabel }}
          formatter={(v, name) => {
            const n = typeof v === 'number' ? v : null;
            return [n !== null ? `${fmt1(n)}h` : '—', String(name)];
          }}
        />
        {pairs.map(({ workstream }, i) => {
          const color = EPIC_COLORS[i % EPIC_COLORS.length];
          const highlighted = activeWorkstream === null || activeWorkstream === workstream.key;
          return (
            <Line
              key={workstream.key}
              type="stepAfter"
              dataKey={workstream.key}
              stroke={color}
              strokeWidth={activeWorkstream === workstream.key ? 2.5 : 1.5}
              strokeOpacity={highlighted ? 1 : 0.12}
              dot={false}
              connectNulls={true}
              name={workstream.key.split('/').pop() || workstream.key}
              isAnimationActive={false}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
