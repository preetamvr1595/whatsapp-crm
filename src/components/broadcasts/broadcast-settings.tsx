/**
 * Broadcast Settings Component
 * Allows users to configure parallel sending and throttling
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ParallelBroadcastConfig } from '@/types';

interface BroadcastSettingsProps {
  config: ParallelBroadcastConfig;
  onChange: (config: ParallelBroadcastConfig) => void;
}

export function BroadcastSettings({ config, onChange }: BroadcastSettingsProps) {
  const [useParallel, setUseParallel] = useState(
    (config.concurrent_workers || 1) > 1
  );

  const handleChange = (key: keyof ParallelBroadcastConfig, value: any) => {
    onChange({
      ...config,
      [key]: value,
    });
  };

  return (
    <Card className="bg-slate-900 border-slate-700 text-white">
      <CardHeader>
        <CardTitle className="text-white">Broadcast Settings</CardTitle>
        <CardDescription className="text-slate-400">
          Configure how messages are sent to recipients
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Parallel vs Sequential */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium text-slate-200">Parallel Sending</Label>
            <p className="text-sm text-slate-400 mt-1">
              Send messages to multiple contacts simultaneously
            </p>
          </div>
          <Switch
            checked={useParallel}
            onCheckedChange={(checked) => {
              setUseParallel(checked);
              if (checked) {
                handleChange('concurrent_workers', 3);
              } else {
                handleChange('concurrent_workers', 1);
              }
            }}
          />
        </div>

        {useParallel && (
          <>
            {/* Concurrent Workers */}
            <div className="space-y-2">
              <Label htmlFor="workers" className="text-slate-300">
                Concurrent Workers
                <span className="text-slate-400 ml-2">
                  ({config.concurrent_workers || 3})
                </span>
              </Label>
              <p className="text-xs text-slate-400">
                Number of messages to send simultaneously (1-10)
              </p>
              <Input
                id="workers"
                type="range"
                min="1"
                max="10"
                value={config.concurrent_workers || 3}
                onChange={(e) => handleChange('concurrent_workers', parseInt(e.target.value))}
                className="w-full bg-slate-800 border-slate-700 accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>Slower (1)</span>
                <span>Faster (10)</span>
              </div>
            </div>

            {/* Delay Between Sends */}
            <div className="space-y-2">
              <Label htmlFor="delay" className="text-slate-300">
                Delay Between Sends
                <span className="text-slate-400 ml-2">
                  ({config.delay_between_sends_ms || 500}ms)
                </span>
              </Label>
              <p className="text-xs text-slate-400">
                Time to wait between sending batches (100-5000ms)
              </p>
              <Input
                id="delay"
                type="range"
                min="100"
                max="5000"
                step="100"
                value={config.delay_between_sends_ms || 500}
                onChange={(e) => handleChange('delay_between_sends_ms', parseInt(e.target.value))}
                className="w-full bg-slate-800 border-slate-700 accent-emerald-500"
              />
            </div>

            {/* Retry Configuration */}
            <div className="space-y-2">
              <Label htmlFor="retries" className="text-slate-300">
                Retry Failed Messages
              </Label>
              <Select
                value={String(config.max_retries || 1)}
                onValueChange={(value) => {
                  if (value !== null) {
                    handleChange('max_retries', parseInt(value));
                  }
                }}
              >
                <SelectTrigger id="retries" className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="0">No retries</SelectItem>
                  <SelectItem value="1">Retry once</SelectItem>
                  <SelectItem value="2">Retry twice</SelectItem>
                  <SelectItem value="3">Retry 3 times</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Performance Info */}
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-3">
              <p className="text-sm font-medium text-emerald-400">⚡ Performance Estimate</p>
              <p className="text-xs text-emerald-300/80 mt-1">
                With {config.concurrent_workers || 3} workers:
                <br />
                1000 messages: ~{Math.ceil(1000 / (config.concurrent_workers || 3) * (config.delay_between_sends_ms || 500) / 1000)}s
              </p>
            </div>
          </>
        )}

        {!useParallel && (
          <div className="bg-amber-950/40 border border-amber-800/50 rounded-lg p-3">
            <p className="text-sm font-medium text-amber-400">⏳ Sequential Mode</p>
            <p className="text-xs text-amber-300/80 mt-1">
              Messages sent one at a time. Slower but more reliable.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
