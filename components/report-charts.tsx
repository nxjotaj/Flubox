'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const money = (value: number) =>
  (value / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });

const monthlyConfig = {
  gmv: { label: 'GMV', color: '#f97316' },
  revenue: { label: 'Receita', color: '#171717' },
} satisfies ChartConfig;

const statusConfig = {
  total: { label: 'Pedidos', color: '#f97316' },
} satisfies ChartConfig;

export function AdminReportCharts({
  monthly,
  statuses,
}: {
  monthly: { period: string; gmv: number; revenue: number }[];
  statuses: { status: string; total: number }[];
}) {
  const timeline = [...monthly].reverse().map((item) => ({
    ...item,
    gmv: Number(item.gmv),
    revenue: Number(item.revenue),
  }));
  const distribution = statuses.slice(0, 8).map((item) => ({
    label: item.status.replaceAll('_', ' '),
    total: Number(item.total),
  }));

  return (
    <section className="analytics-grid" aria-label="Gráficos operacionais">
      <article className="surface-card chart-card">
        <header>
          <div>
            <span className="chart-eyebrow">Evolução financeira</span>
            <h2>Volume e receita</h2>
            <p>Movimento mensal confirmado na plataforma.</p>
          </div>
        </header>
        {timeline.length ? (
          <ChartContainer config={monthlyConfig} className="operations-chart">
            <AreaChart data={timeline} margin={{ left: 4, right: 12, top: 12 }}>
              <defs>
                <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-gmv)"
                    stopOpacity={0.32}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-gmv)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="4 6" />
              <XAxis dataKey="period" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => money(Number(value))}
                width={76}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <>
                        <span>
                          {
                            monthlyConfig[
                              String(name) as keyof typeof monthlyConfig
                            ]?.label
                          }
                        </span>
                        <strong>{money(Number(value))}</strong>
                      </>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="gmv"
                stroke="var(--color-gmv)"
                strokeWidth={3}
                fill="url(#gmvFill)"
                animationDuration={850}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                strokeWidth={2}
                fill="transparent"
                animationDuration={1050}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="empty-state compact">
            <strong>Primeiro período em formação</strong>
            <p>O gráfico aparece após a primeira movimentação mensal.</p>
          </div>
        )}
      </article>
      <article className="surface-card chart-card">
        <header>
          <div>
            <span className="chart-eyebrow">Fluxo operacional</span>
            <h2>Pedidos por situação</h2>
            <p>Onde a operação está concentrada agora.</p>
          </div>
        </header>
        {distribution.length ? (
          <ChartContainer
            config={statusConfig}
            className="operations-chart compact-chart"
          >
            <BarChart
              data={distribution}
              layout="vertical"
              margin={{ left: 4, right: 20, top: 10 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="4 6" />
              <XAxis type="number" hide />
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                width={116}
                tick={{ fontSize: 10 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="total"
                fill="var(--color-total)"
                radius={[0, 8, 8, 0]}
                animationDuration={900}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="empty-state compact">
            <strong>Sem pedidos ainda</strong>
            <p>A distribuição será criada automaticamente.</p>
          </div>
        )}
      </article>
    </section>
  );
}
