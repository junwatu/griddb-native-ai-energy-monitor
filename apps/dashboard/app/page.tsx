'use client';

import { useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, BrainCircuit, CheckCircle2,
  Clock3, Cloud, Database, Gauge, Lightbulb, Moon, RefreshCw, Sun,
  WalletCards, Zap,
} from 'lucide-react';
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

type Range = '24h' | '7d' | '30d';

const devices = {
  ac_office_01: {
    id: 'ac_office_01', name: 'Office air conditioner', shortName: 'Office AC',
    type: 'HVAC', watts: 1142, todayKwh: 8.72, cost: 1.21,
    forecastKwh: 10.24, trend: -6.8, peakHour: '18:00', status: 'Operating',
    quality: 100, base: 0.92, amplitude: 0.36,
  },
  cold_room_02: {
    id: 'cold_room_02', name: 'Cold-room compressor', shortName: 'Cold room',
    type: 'Refrigeration', watts: 768, todayKwh: 12.46, cost: 1.73,
    forecastKwh: 13.18, trend: 3.2, peakHour: '15:00', status: 'Cycling',
    quality: 98, base: 0.68, amplitude: 0.19,
  },
  water_pump_01: {
    id: 'water_pump_01', name: 'Production water pump', shortName: 'Water pump',
    type: 'Motor', watts: 1548, todayKwh: 6.34, cost: 0.88,
    forecastKwh: 7.06, trend: -1.4, peakHour: '20:00', status: 'Operating',
    quality: 96, base: 1.08, amplitude: 0.54,
  },
} as const;

type DeviceId = keyof typeof devices;

const chartConfig = {
  actual: { label: 'Actual', color: 'var(--chart-1)' },
  forecast: { label: 'Forecast', color: 'var(--chart-2)' },
  range: { label: 'Confidence range', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const rangeMultiplier: Record<Range, number> = { '24h': 1, '7d': 7.2, '30d': 31 };

function createSeries(deviceId: DeviceId, range: Range) {
  const device = devices[deviceId];
  const multiplier = rangeMultiplier[range];
  const points = range === '24h' ? 25 : range === '7d' ? 14 : 15;
  const nowIndex = range === '24h' ? 11 : range === '7d' ? 8 : 10;
  const weekLabels = ['Mon', 'Mon PM', 'Tue', 'Tue PM', 'Wed', 'Wed PM', 'Thu', 'Thu PM', 'Fri', 'Fri PM', 'Sat', 'Sat PM', 'Sun', 'Sun PM'];

  return Array.from({ length: points }, (_, index) => {
    const wave = Math.sin(index * 0.72 + device.base) * device.amplitude;
    const workdayLift = index > points * 0.28 && index < points * 0.76 ? 0.42 : 0;
    const predicted = Math.max(0.16, device.base + wave + workdayLift) * multiplier;
    const actualNoise = Math.cos(index * 1.37) * 0.055 * multiplier;
    const label = range === '24h'
      ? `${String(index).padStart(2, '0')}:00`
      : range === '7d' ? weekLabels[index] : `${index * 2 + 1} Aug`;

    return {
      time: label,
      actual: index <= nowIndex ? Number((predicted + actualNoise).toFixed(2)) : null,
      forecast: index >= nowIndex ? Number(predicted.toFixed(2)) : null,
      range: index >= nowIndex
        ? [Number((predicted * 0.88).toFixed(2)), Number((predicted * 1.12).toFixed(2))]
        : null,
      now: index === nowIndex,
    };
  });
}

function MetricCard({ label, value, unit, detail, icon: Icon, accent = 'emerald' }: {
  label: string; value: string; unit?: string; detail: string; icon: typeof Zap;
  accent?: 'emerald' | 'violet' | 'amber' | 'cyan';
}) {
  const accents = {
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    cyan: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  };

  return (
    <Card className="border-0 shadow-[0_1px_0_rgb(15_23_42/4%),0_12px_30px_rgb(15_23_42/5%)]">
      <CardHeader className="pb-0">
        <CardDescription className="flex items-center gap-2 font-medium">
          <span className={`grid size-7 place-items-center rounded-lg ${accents[accent]}`}>
            <Icon className="size-3.5" />
          </span>
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.7rem]">{value}</span>
          {unit ? <span className="text-xs font-medium text-muted-foreground">{unit}</span> : null}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [deviceId, setDeviceId] = useState<DeviceId>('ac_office_01');
  const [range, setRange] = useState<Range>('24h');
  const [dark, setDark] = useState(false);
  const [updatedAt, setUpdatedAt] = useState('just now');
  const device = devices[deviceId];
  const series = useMemo(() => createSeries(deviceId, range), [deviceId, range]);
  const nowLabel = series.find((point) => point.now)?.time ?? '';

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  }

  function refresh() {
    setUpdatedAt('just now');
    window.setTimeout(() => setUpdatedAt('a few seconds ago'), 3500);
  }

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-background pb-10 text-foreground">
        <header className="border-b border-white/8 bg-[linear-gradient(120deg,#071d19_0%,#0a2822_58%,#12253a_100%)] text-white">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 shadow-inner">
                <Activity className="size-5 text-emerald-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-tight sm:text-xl">GridDB Energy AI</h1>
                  <Badge className="border-emerald-300/15 bg-emerald-300/10 text-emerald-200">Prototype</Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-300">Native GridDB architecture · deterministic mock data</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-1 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-50" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-300" />
                </span>
                Native bridge ready
              </div>
              <Select value={deviceId} onValueChange={(value) => setDeviceId(value as DeviceId)}>
                <SelectTrigger className="h-9 min-w-48 border-white/12 bg-white/8 text-white hover:bg-white/12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {Object.values(devices).map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger render={<Button aria-label="Toggle color theme" variant="outline" size="icon-lg" className="border-white/12 bg-white/8 text-white hover:bg-white/15 hover:text-white" onClick={toggleTheme} />}>
                  {dark ? <Sun /> : <Moon />}
                </TooltipTrigger>
                <TooltipContent>{dark ? 'Use light theme' : 'Use dark theme'}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1480px] space-y-5 px-4 pt-6 sm:px-6 lg:px-8">
          <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" aria-labelledby="overview-title">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                <Database className="size-3.5" /> energy_{device.id}
              </div>
              <h2 id="overview-title" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{device.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Live operating view with the next 24-hour consumption forecast.</p>
            </div>
            <div className="flex items-center gap-3">
              <Tabs value={range} onValueChange={(value) => setRange(value as Range)}>
                <TabsList>
                  <TabsTrigger value="24h">24 hours</TabsTrigger>
                  <TabsTrigger value="7d">7 days</TabsTrigger>
                  <TabsTrigger value="30d">30 days</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="outline" onClick={refresh}>
                <RefreshCw data-icon="inline-start" /> Refresh
              </Button>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Energy summary">
            <MetricCard label="Live load" value={(device.watts / 1000).toFixed(2)} unit="kW" detail="Current real power" icon={Zap} />
            <MetricCard label="Energy today" value={device.todayKwh.toFixed(2)} unit="kWh" detail="Since 00:00 local" icon={Gauge} accent="cyan" />
            <MetricCard label="Cost today" value={`$${device.cost.toFixed(2)}`} detail="$0.139 per kWh" icon={WalletCards} accent="amber" />
            <MetricCard label="Next 24 hours" value={device.forecastKwh.toFixed(2)} unit="kWh" detail="Forecast consumption" icon={BrainCircuit} accent="violet" />
            <MetricCard label="vs. typical day" value={`${Math.abs(device.trend).toFixed(1)}%`} detail={device.trend <= 0 ? 'Lower expected usage' : 'Higher expected usage'} icon={device.trend <= 0 ? ArrowDownRight : ArrowUpRight} accent={device.trend <= 0 ? 'emerald' : 'amber'} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,.72fr)]">
            <Card className="border-0 shadow-[0_1px_0_rgb(15_23_42/4%),0_16px_40px_rgb(15_23_42/6%)]">
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle>Actual usage and forecast</CardTitle>
                <CardDescription>
                  {range === '24h' ? 'Hourly average power' : range === '7d' ? 'Half-day energy totals' : 'Two-day energy totals'} · confidence interval ±12%
                </CardDescription>
                <CardAction>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-emerald-500" /> Actual</span>
                    <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-violet-500" /> Forecast</span>
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="pt-4">
                <ChartContainer config={chartConfig} className="h-[320px] w-full aspect-auto" initialDimension={{ width: 900, height: 320 }}>
                  <ComposedChart data={series} margin={{ left: 2, right: 12, top: 12, bottom: 0 }} accessibilityLayer>
                    <defs>
                      <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-actual)" stopOpacity={0.26} />
                        <stop offset="95%" stopColor="var(--color-actual)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 4" />
                    <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={28} tickMargin={10} />
                    <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(value) => `${value}`} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <Area type="monotone" dataKey="range" stroke="none" fill="var(--color-forecast)" fillOpacity={0.11} connectNulls={false} />
                    <Area type="monotone" dataKey="actual" stroke="var(--color-actual)" strokeWidth={2.5} fill="url(#actualFill)" connectNulls={false} />
                    <Line type="monotone" dataKey="forecast" stroke="var(--color-forecast)" strokeWidth={2.5} strokeDasharray="7 5" dot={false} connectNulls={false} />
                    <ReferenceLine x={nowLabel} stroke="var(--border)" strokeDasharray="3 3" label={{ value: 'Now', position: 'insideTopRight', fill: 'var(--muted-foreground)', fontSize: 10 }} />
                  </ComposedChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="relative border-0 bg-[linear-gradient(155deg,#102b27_0%,#13233b_100%)] text-white shadow-[0_18px_45px_rgb(10_35_31/18%)]">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-violet-400/10 blur-3xl" />
              <CardHeader className="relative border-b border-white/10 pb-4">
                <CardDescription className="text-emerald-300">AI energy insight</CardDescription>
                <CardTitle className="text-lg text-white">Shift the evening peak</CardTitle>
                <CardAction>
                  <span className="grid size-9 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300"><Lightbulb className="size-4" /></span>
                </CardAction>
              </CardHeader>
              <CardContent className="relative space-y-5 pt-1">
                <p className="text-sm leading-6 text-slate-200">
                  {device.shortName} is expected to peak near <strong className="text-white">{device.peakHour}</strong>. Moving one operating cycle 90 minutes earlier could reduce peak-period consumption by approximately <strong className="text-emerald-300">0.8 kWh</strong>.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Confidence</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">86%</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Potential saving</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">$0.18</p>
                  </div>
                </div>
                <div className="rounded-xl border border-amber-300/15 bg-amber-300/8 p-3 text-xs leading-5 text-amber-100">
                  This recommendation is generated from mock forecast values. Production actions should include operator approval.
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,.5fr)]">
            <Card className="border-0 shadow-[0_1px_0_rgb(15_23_42/4%),0_12px_30px_rgb(15_23_42/5%)]">
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle>Connected devices</CardTitle>
                <CardDescription>Mock registry rows mapped to per-device TimeSeries containers.</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead><TableHead>Type</TableHead>
                      <TableHead className="text-right">Live load</TableHead>
                      <TableHead className="text-right">Today</TableHead><TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(devices).map((item) => (
                      <TableRow key={item.id} className="cursor-pointer" onClick={() => setDeviceId(item.id as DeviceId)} data-state={item.id === deviceId ? 'selected' : undefined}>
                        <TableCell>
                          <div className="font-medium">{item.shortName}</div>
                          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{item.id}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.type}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{(item.watts / 1000).toFixed(2)} kW</TableCell>
                        <TableCell className="text-right tabular-nums">{item.todayKwh.toFixed(2)} kWh</TableCell>
                        <TableCell><Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-500" />{item.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-[0_1px_0_rgb(15_23_42/4%),0_12px_30px_rgb(15_23_42/5%)]">
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle>Data pipeline</CardTitle>
                <CardDescription>Prototype health and freshness</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
                  <div><p className="text-sm font-medium">Mock stream active</p><p className="text-xs text-muted-foreground">Latest reading {updatedAt}</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Cloud className="mt-0.5 size-4 text-violet-600" />
                  <div><p className="text-sm font-medium">GridDB Cloud path</p><p className="text-xs text-muted-foreground">Native TLS/TCP · no Web API</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 size-4 text-amber-600" />
                  <div><p className="text-sm font-medium">15-minute interval</p><p className="text-xs text-muted-foreground">Quality score {device.quality}/100</p></div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </TooltipProvider>
  );
}
