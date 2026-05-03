'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { formatNaira } from '@/lib/formatters';

interface Props {
  data: Array<{ month: string; amount_kobo: number }>;
}

export default function RevenueChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
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
          tickFormatter={(v: number) => `₦${(v / 10_000_000).toFixed(0)}M`}
        />
        <Tooltip
          formatter={(v: number) => [formatNaira(v), 'Revenue']}
          contentStyle={{
            fontSize: 12,
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            background: '#fff',
            boxShadow: '0 4px 12px rgba(10,22,40,0.08)',
          }}
          labelStyle={{ color: '#5A6A85', fontWeight: 600, marginBottom: 2 }}
          cursor={{ fill: 'rgba(10,22,40,0.03)' }}
        />
        <Bar
          dataKey="amount_kobo"
          fill="#F5A623"
          radius={[4, 4, 0, 0]}
          maxBarSize={44}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
