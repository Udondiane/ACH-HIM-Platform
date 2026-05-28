'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

const DOMAIN_LABELS: Record<string, string> = {
  employment: 'Employment',
  housing:    'Housing',
  education:  'Education',
  health:     'Health',
  belonging:  'Belonging',
  social:     'Social',
  rights:     'Rights',
};

interface SeriesPoint {
  domain: string;
  baseline?: number | null;
  exit?: number | null;
  current?: number | null;
}

interface Props {
  data: SeriesPoint[];
  /** show comparison between baseline and exit, or just current */
  mode?: 'comparison' | 'current';
  height?: number;
}

export function CapabilityRadar({ data, mode = 'comparison', height = 320 }: Props) {
  const chartData = data.map(d => ({
    domain: DOMAIN_LABELS[d.domain] ?? d.domain,
    baseline: d.baseline ?? 0,
    exit: d.exit ?? 0,
    current: d.current ?? 0,
  }));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RadarChart data={chartData} outerRadius="75%">
          <PolarGrid stroke="#EEEAE0" />
          <PolarAngleAxis
            dataKey="domain"
            tick={{ fill: '#0A1F3D', fontSize: 11 }}
          />
          <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: '#0A1F3D', fontSize: 9, opacity: 0.55 }} />
          {mode === 'comparison' ? (
            <>
              <Radar
                name="Baseline"
                dataKey="baseline"
                stroke="#7FA6CC"
                fill="#7FA6CC"
                fillOpacity={0.25}
              />
              <Radar
                name="Exit"
                dataKey="exit"
                stroke="#0A1F3D"
                fill="#0A1F3D"
                fillOpacity={0.35}
              />
            </>
          ) : (
            <Radar
              name="Current"
              dataKey="current"
              stroke="#0A1F3D"
              fill="#0A1F3D"
              fillOpacity={0.35}
            />
          )}
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: '0.5px solid #EEEAE0',
              borderRadius: 10,
              fontSize: 12,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
