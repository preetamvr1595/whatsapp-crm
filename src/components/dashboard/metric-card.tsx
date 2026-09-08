import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  /** Pre-formatted value for display (e.g. "42" or "$1,250"). */
  value: string
  icon: ComponentType<{ className?: string }>
  /**
   * Delta-mode secondary row: arrow + delta text. Omit when the metric
   * doesn't have a sensible comparison (e.g. total pipeline value).
   */
  delta?: {
    /** Positive / negative / zero drives arrow + color. */
    sign: number
    /** Pre-formatted delta, e.g. "+3 vs yesterday". */
    label: string
  }
  /** Used instead of `delta` when the metric has a static subtitle. */
  subtitle?: string
}

export function MetricCard({ title, value, icon: Icon, delta, subtitle }: MetricCardProps) {
  return (
    <div className="glass-card-hover p-5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 -mr-4 -mt-4 w-20 h-20 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-400">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/60 text-primary shadow-inner group-hover:scale-110 transition-transform">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 text-3xl leading-none font-extrabold tabular-nums text-white tracking-tight">
        {value}
      </p>
      {delta ? <DeltaRow sign={delta.sign} label={delta.label} /> : subtitle ? (
        <p className="mt-2.5 text-xs text-slate-400 font-medium">{subtitle}</p>
      ) : null}
    </div>
  )
}

function DeltaRow({ sign, label }: { sign: number; label: string }) {
  const tone =
    sign > 0
      ? 'text-primary'
      : sign < 0
      ? 'text-red-400'
      : 'text-slate-500'
  const Arrow = sign > 0 ? ArrowUp : sign < 0 ? ArrowDown : Minus
  return (
    <div className={cn('mt-2 flex items-center gap-1 text-sm', tone)}>
      <Arrow className="h-4 w-4" aria-hidden />
      <span className="tabular-nums">{label}</span>
    </div>
  )
}
