'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type UsagePoint = { timestamp: string; loadKw: number };

type Forecast = {
  energyKwh: number;
  cost: number;
  modelVersion: string;
  generatedAt: string;
  usage: UsagePoint[];
};

type Device = {
  id: string;
  container: string;
  name: string;
  type: string;
  ratedWatts: number;
  pricePerKwh: number;
  loadKw: number;
  energyKwh: number;
  cost: number;
  status: 'Normal' | 'Watch';
  anomaly: boolean;
  latestAt: string | null;
  quality: number | null;
  usage?: UsagePoint[];
  forecast?: Forecast | null;
};

type DashboardData = {
  source: 'griddb';
  generatedAt: string;
  devices: Device[];
  selectedId?: string;
};

const apiBaseUrl = 'http://127.0.0.1:3001';

const chartConfig = {
  actual: { label: 'Actual', color: 'var(--chart-1)' },
  forecast: { label: 'Forecast', color: 'var(--chart-2)' },
} satisfies ChartConfig;

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function readingTime(value: string | null) {
  if (!value) return 'No readings yet';
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [requestedId, setRequestedId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const query = requestedId
      ? `?device=${encodeURIComponent(requestedId)}`
      : '';

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${apiBaseUrl}/api/dashboard${query}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || 'GridDB request failed');
        setData(body);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === 'AbortError'
        )
          return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not reach GridDB',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [requestedId, refreshKey]);

  const selectedId = requestedId || data?.selectedId || data?.devices[0]?.id;
  const selected =
    data?.devices.find((device) => device.id === selectedId) ??
    data?.devices[0];
  const usage = useMemo(
    () =>
      [
        ...(selected?.usage ?? []).map((point) => ({
          timestamp: point.timestamp,
          time: new Date(point.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          actual: Number(point.loadKw.toFixed(2)),
        })),
        ...(selected?.forecast?.usage ?? []).map((point) => ({
          timestamp: point.timestamp,
          time: new Date(point.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          forecast: Number(point.loadKw.toFixed(2)),
        })),
      ].sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
    [selected?.forecast?.usage, selected?.usage],
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white">
              <Activity className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">Energy monitor</h1>
                <Badge variant="secondary">Live GridDB</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                GridDB Cloud + Node.js native bridge
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className={`size-2 rounded-full ${error ? 'bg-red-500' : data ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
              {error ? 'Disconnected' : data ? 'Connected' : 'Connecting'}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              <RefreshCw
                data-icon="inline-start"
                className={loading ? 'animate-spin' : ''}
              />{' '}
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        {error ? (
          <Card className="border-red-200 bg-red-50 shadow-sm">
            <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-red-900">
                  Could not load GridDB data
                </p>
                <p className="mt-1 text-sm text-red-700">
                  {error}. Start the app with npm run dev:live.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setRefreshKey((value) => value + 1)}
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!data && loading ? (
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Connecting to GridDB Cloud…
            </CardContent>
          </Card>
        ) : null}

        {data && data.devices.length === 0 ? (
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-8 text-center">
              <p className="font-medium">No active devices found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Insert device rows and meter readings, or run npm run seed for
                demo data stored in GridDB.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {selected ? (
          <>
            <section>
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-emerald-700">
                <Database className="size-3.5" /> {selected.container}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                {selected.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Latest reading: {readingTime(selected.latestAt)}
              </p>
            </section>

            <section
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              aria-label="Energy summary"
            >
              <Metric
                label="Current load"
                value={`${selected.loadKw.toFixed(2)} kW`}
                note="Latest GridDB reading"
              />
              <Metric
                label="Last 24 hours"
                value={`${selected.energyKwh.toFixed(2)} kWh`}
                note={`${selected.quality ?? '—'}/100 data quality`}
              />
              <Metric
                label="Estimated cost"
                value={`$${selected.cost.toFixed(2)}`}
                note={`At $${selected.pricePerKwh.toFixed(3)} per kWh`}
              />
              <Metric
                label="Next 24 hours"
                value={
                  selected.forecast
                    ? `${selected.forecast.energyKwh.toFixed(2)} kWh`
                    : 'Not ready'
                }
                note={
                  selected.forecast
                    ? `Estimated cost $${selected.forecast.cost.toFixed(2)}`
                    : 'Run npm run forecast'
                }
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <Card className="border-border/70 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-base">
                      Usage and prediction
                    </CardTitle>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <i className="size-2 rounded-full bg-emerald-600" />
                        Actual
                      </span>
                      <span className="flex items-center gap-1.5">
                        <i className="size-2 rounded-full bg-violet-600" />
                        Forecast
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Previous and predicted 24-hour load
                  </p>
                </CardHeader>
                <CardContent>
                  {usage.length ? (
                    <ChartContainer
                      config={chartConfig}
                      className="h-[280px] w-full aspect-auto"
                      initialDimension={{ width: 720, height: 280 }}
                    >
                      <ComposedChart
                        data={usage}
                        margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                        accessibilityLayer
                      >
                        <defs>
                          <linearGradient
                            id="loadFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="var(--color-actual)"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="var(--color-actual)"
                              stopOpacity={0.02}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 4" />
                        <XAxis
                          dataKey="time"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          minTickGap={36}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={42}
                          tickFormatter={(value) => `${value}`}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area
                          type="monotone"
                          dataKey="actual"
                          stroke="var(--color-actual)"
                          strokeWidth={2.5}
                          fill="url(#loadFill)"
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="forecast"
                          stroke="var(--color-forecast)"
                          strokeWidth={2.5}
                          strokeDasharray="7 5"
                          dot={false}
                          connectNulls={false}
                        />
                      </ComposedChart>
                    </ChartContainer>
                  ) : (
                    <div className="grid h-[280px] place-items-center text-sm text-muted-foreground">
                      No readings in the last 24 hours
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-violet-600" />
                    <CardTitle className="text-base">Anomaly check</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                    {selected.anomaly ? (
                      <AlertTriangle className="size-5 shrink-0 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {selected.anomaly
                          ? 'Usage needs attention'
                          : 'No anomaly detected'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Latest reading vs. the 24-hour pattern
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {selected.anomaly
                      ? 'The latest load is unusually high for this device. Check its operating state before taking action.'
                      : 'The latest load is inside the expected statistical range for this device.'}
                  </p>
                  <p className="border-t pt-4 text-xs text-muted-foreground">
                    This check uses a simple 2.5 standard-deviation threshold.
                    It does not control equipment.
                  </p>
                </CardContent>
              </Card>
            </section>

            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">Devices</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Select a row to query its TimeSeries
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Zap className="size-3.5" /> {data?.devices.length ?? 0}{' '}
                    active
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Load</TableHead>
                      <TableHead className="text-right">24 hours</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.devices.map((device) => (
                      <TableRow
                        key={device.id}
                        className="cursor-pointer"
                        data-state={
                          device.id === selected.id ? 'selected' : undefined
                        }
                        onClick={() => setRequestedId(device.id)}
                      >
                        <TableCell>
                          <p className="font-medium">{device.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {device.id}
                          </p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {device.type}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {device.loadKw.toFixed(2)} kW
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {device.energyKwh.toFixed(2)} kWh
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              device.anomaly
                                ? 'bg-amber-500/10 text-amber-700'
                                : 'bg-emerald-500/10 text-emerald-700'
                            }
                          >
                            {device.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </main>
  );
}
