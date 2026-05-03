'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  data: Array<{ month: string; students: number }>;
}

export default function EnrollmentChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0A1628" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#0A1628" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,22,40,0.05)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#9BAEC8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9BAEC8' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            background: '#fff',
            boxShadow: '0 4px 12px rgba(10,22,40,0.08)',
          }}
          itemStyle={{ color: '#0A1628' }}
          labelStyle={{ color: '#5A6A85', fontWeight: 600, marginBottom: 2 }}
          cursor={{ stroke: 'rgba(10,22,40,0.08)' }}
        />
        <Area
          type="monotone"
          dataKey="students"
          stroke="#F5A623"
          strokeWidth={2}
          fill="url(#enrollGrad)"
          dot={{ r: 3, fill: '#F5A623', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#F5A623', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
