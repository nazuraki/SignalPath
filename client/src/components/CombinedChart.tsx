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

interface Props {
  pairs: WorkstreamPair[];
  activeWorkstream: string | null;
}

export default function CombinedChart({ pairs, activeWorkstream }: Props) {
  const series = buildCombinedSeries(pairs);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={series} margin={{ top: 10, right: 28, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="#1f1f23" strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="label"
          stroke="#52525b"
          fontSize={10}
          tick={{ fontFamily: 'JetBrains Mono, monospace' }}
          interval="preserveStartEnd"
          minTickGap={60}
        />
        <YAxis
          stroke="#52525b"
          fontSize={10}
          tick={{ fontFamily: 'JetBrains Mono, monospace' }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0c0c0d',
            border: '1px solid #2a2a2e',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
          }}
          labelStyle={{ color: '#a3a3a3' }}
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
              name={workstream.key}
              isAnimationActive={false}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
