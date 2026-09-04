/**
 * Broadcast Progress Component
 * Shows real-time progress of broadcast sending
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';

interface BroadcastProgressProps {
  broadcastId: string;
  totalRecipients: number;
  onComplete?: () => void;
}

interface BroadcastStatus {
  broadcast: {
    id: string;
    status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'partial' | 'failed' | 'sent';
    created_at: string;
    started_at?: string;
    completed_at?: string;
  };
  stats: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
}

export function BroadcastProgress({
  broadcastId,
  totalRecipients,
  onComplete,
}: BroadcastProgressProps) {
  const [statusData, setStatusData] = useState<BroadcastStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchStatus = async () => {
      try {
        const res = await fetch(
          `/api/whatsapp/broadcast/parallel?broadcast_id=${broadcastId}`
        );
        if (res.ok) {
          const data: BroadcastStatus = await res.json();
          setStatusData(data);
          setLoading(false);

          if (
            ['completed', 'partial', 'failed', 'sent'].includes(data.broadcast.status)
          ) {
            clearInterval(intervalId);
            onComplete?.();
          }
        }
      } catch (err) {
        console.error('Failed to fetch broadcast status:', err);
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 2000);

    return () => clearInterval(intervalId);
  }, [broadcastId, onComplete]);

  if (loading) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="py-6 flex items-center justify-center text-slate-400">
          <Loader2 className="size-5 animate-spin mr-2 text-primary" />
          Loading broadcast progress…
        </CardContent>
      </Card>
    );
  }

  const stats = statusData?.stats || { sent: 0, delivered: 0, read: 0, failed: 0 };
  const processedCount = stats.sent + stats.failed;
  const progressPercent = totalRecipients > 0 ? Math.round((processedCount / totalRecipients) * 100) : 0;
  const bStatus = statusData?.broadcast.status || 'sending';

  return (
    <Card className="bg-slate-900 border-slate-700 text-white">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {bStatus === 'sending' && <Loader2 className="size-4 animate-spin text-blue-400" />}
            {bStatus === 'completed' && <CheckCircle2 className="size-4 text-emerald-400" />}
            {bStatus === 'failed' && <AlertCircle className="size-4 text-red-400" />}
            <span className="font-semibold text-white capitalize">
              Broadcast {bStatus}
            </span>
          </div>
          <Badge
            variant="outline"
            className={
              bStatus === 'completed'
                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                : bStatus === 'sending'
                ? 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                : 'border-slate-700 text-slate-400'
            }
          >
            {progressPercent}% Complete
          </Badge>
        </div>

        <Progress value={progressPercent} className="h-2 bg-slate-800" />

        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-slate-800/60 p-2 rounded border border-slate-700/50">
            <p className="text-slate-400">Total</p>
            <p className="text-base font-bold text-white mt-0.5">{totalRecipients}</p>
          </div>
          <div className="bg-blue-950/30 p-2 rounded border border-blue-900/40">
            <p className="text-blue-400">Sent</p>
            <p className="text-base font-bold text-blue-300 mt-0.5">{stats.sent}</p>
          </div>
          <div className="bg-emerald-950/30 p-2 rounded border border-emerald-900/40">
            <p className="text-emerald-400">Delivered</p>
            <p className="text-base font-bold text-emerald-300 mt-0.5">{stats.delivered}</p>
          </div>
          <div className="bg-red-950/30 p-2 rounded border border-red-900/40">
            <p className="text-red-400">Failed</p>
            <p className="text-base font-bold text-red-300 mt-0.5">{stats.failed}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
