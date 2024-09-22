'use client'

import { Button } from '@/components/ui/button'
import { useParams, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getServiceLogs } from '@/actions/fetch-logs'
import { deleteService } from '@/actions/delete-service'
import { getPodMetrics } from '@/actions/get-pod-metrics'
import { RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'

export default function ServiceView() {
  const { 'service-id': serviceId } = useParams()

  const searchParams = useSearchParams()

  const section = searchParams.get('section')
  const title = searchParams.get('title')

  const [logs, setLogs] = useState<string>('')
  const [isPolling, setIsPolling] = useState(false)
  const [loadingPolling, setLoadingPolling] = useState(false)

  const fetchLogs = useCallback(async () => {
    if (!title) return

    setLoadingPolling(true)

    const serviceLogs = await getServiceLogs(title as string)

    setTimeout(() => {
      setLoadingPolling(false)
    }, 500)
    setLogs(serviceLogs)
  }, [title])

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    if (isPolling) {
      fetchLogs()

      intervalId = setInterval(fetchLogs, 3000)
    } else if (intervalId) {
      clearInterval(intervalId)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [fetchLogs, isPolling, title])

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!title) return

      const podMetrics = await getPodMetrics(title as string)

      console.log({ podMetrics })
    }

    fetchMetrics()
  }, [serviceId, title])

  const chartData = useMemo(
    () => [
      { month: 'January', desktop: 186 },
      { month: 'February', desktop: 305 },
      { month: 'March', desktop: 237 },
      { month: 'April', desktop: 73 },
      { month: 'May', desktop: 209 },
      { month: 'June', desktop: 214 },
    ],
    []
  )

  const chartConfig = {
    desktop: {
      label: 'Desktop',
      color: 'hsl(var(--chart-1))',
    },
  } satisfies ChartConfig

  return useMemo(() => {
    return (
      <Tabs defaultValue={(section as string) || 'general'}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="py-4">
          <div className="border-destructive border rounded-md p-4 border-dashed relative flex gap-8 flex-col">
            <div className="absolute top-[-18px] bg-background p-1 text-destructive">
              Danger zone
            </div>
            <p>
              Are you sure you want to delete this service? This action cannot
              be undone.
            </p>

            <Button
              variant="destructive"
              className="w-fit"
              onClick={() => deleteService(serviceId as string)}
            >
              Delete service
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="logs" className="py-4 space-y-5">
          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <Switch onCheckedChange={setIsPolling} checked={isPolling} />
              <p>
                {isPolling ? 'Disable auto refresh' : 'Enable auto refresh'}
              </p>
            </div>

            <Button variant="ghost" size="sm" onClick={fetchLogs}>
              <RefreshCcw className={cn({ 'animate-spin': loadingPolling })} />
            </Button>
          </div>

          <div
            className="bg-accent rounded-md p-2 max-h-[800px] overflow-y-auto"
            style={{ whiteSpace: 'pre-line' }}
          >
            {logs}
          </div>
        </TabsContent>
        <TabsContent value="monitoring" className="flex flex-wrap gap-y-6 py-4">
          <div className="w-1/2 space-y-5">
            <p>CPU</p>

            <ChartContainer config={chartConfig}>
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Area
                  dataKey="desktop"
                  type="natural"
                  fill="var(--color-desktop)"
                  fillOpacity={0.4}
                  stroke="var(--color-desktop)"
                />
              </AreaChart>
            </ChartContainer>
          </div>

          <div className="w-1/2 space-y-5">
            <p>Memory</p>

            <ChartContainer config={chartConfig}>
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Area
                  dataKey="desktop"
                  type="natural"
                  fill="var(--color-desktop)"
                  fillOpacity={0.4}
                  stroke="var(--color-desktop)"
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </TabsContent>
      </Tabs>
    )
  }, [
    chartConfig,
    chartData,
    fetchLogs,
    isPolling,
    loadingPolling,
    logs,
    section,
    serviceId,
  ])
}
