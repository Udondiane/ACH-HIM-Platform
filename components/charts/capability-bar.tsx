'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const DOMAIN_LABELS: Record<string, string> = {
  employment: 'Employment',
  housing:    'Housing',
  education:  'Education',
  health:     'Health',
  belonging:  'Belonging',
  social:     'Social',
  rights:     'Rights',
};

const DOMAIN_COLORS: Record<string, string> = {
  employment: '#E07B2F',
  housing:    '#5BAFD6',
  education:  '#5E7A3C',
  health:     '#9BBF7C',
  belonging:  '#F2C744',
  social:     '#1F3A6B',
  rights:     '#7F5BD6',
};

interface BarPoint {
  domain: string;
  score: number;
  role?: 'core' | 'optional';
}

export function CapabilityBar({ data, height = 280 }: { data: BarPoint[]; height?: number }) {
  const chartData = data.map(d => ({
    domain: DOMAIN_LABELS[d.domain] ?? d.domain,
    score: Number(d.score.toFixed(2)),
    color: DOMAIN_COLORS[d.domain] ?? '#0A1F3D',
    role: d.role,
  }));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="#EEEAE0" vertical={false} />
          <XAxis dataKey="domain" tick={{ fill: '#0A1F3D', fontSize: 10.5 }} />
          <YAxis domain={[0, 5]} tick={{ fill: '#0A1F3D', fontSize: 10.5 }} />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: '0.5px solid #EEEAE0',
              borderRadius: 10,
              fontSize: 12,
            }}
            formatter={(value: any, _name: any, ctx: any) => [`${value}/5`, ctx.payload.role === 'core' ? 'Core' : 'Optional']}
          />
          <Bar dataKey="score" radius={[6, 6, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.color} fillOpacity={d.role === 'optional' ? 0.55 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
