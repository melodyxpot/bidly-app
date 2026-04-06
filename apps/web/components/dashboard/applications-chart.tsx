"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import type { ChartDataPoint } from "@/lib/types"

interface ApplicationsChartProps {
  data: ChartDataPoint[]
}

export function ApplicationsChart({ data }: ApplicationsChartProps) {
  const totalCount = data.reduce((sum, p) => sum + p.count, 0)
  const avg = data.length > 0 ? totalCount / data.length : 0

  const formattedData = data.map((point, i) => {
    const windowStart = Math.max(0, i - 2)
    const window = data.slice(windowStart, i + 1)
    const movingAvg = window.reduce((s, p) => s + p.count, 0) / window.length
    return {
      ...point,
      label: new Date(point.date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
      }),
      movingAvg: Math.round(movingAvg * 10) / 10,
    }
  })

  const totalApplications = data.reduce((sum, point) => sum + point.count, 0)
  const avgPerDay = data.length > 0 ? Math.round(totalApplications / data.length) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Applications Over Time</CardTitle>
        <CardDescription>
          Last 14 days - Total: {totalApplications} applications, Avg: {avgPerDay}/day
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="countGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#67e8f9" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="count"
                stroke="#4ade80"
                strokeWidth={2}
                fill="url(#countGradient)"
                name="Applications"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="movingAvg"
                stroke="#67e8f9"
                strokeWidth={2}
                fill="url(#avgGradient)"
                name="Daily Avg"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
