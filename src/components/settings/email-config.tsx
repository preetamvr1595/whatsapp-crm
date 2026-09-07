'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Mail, Loader2, CheckCircle2, Server, Key, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Provider = 'resend' | 'sendgrid' | 'smtp';

export function EmailConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);

  const [provider, setProvider] = useState<Provider>('resend');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      setLoading(true);
      const res = await fetch('/api/email/config');
      const data = await res.json();

      if (res.ok && data.configured && data.config) {
        setConfigured(true);
        setProvider(data.config.provider || 'resend');
        setFromName(data.config.from_name || '');
        setFromEmail(data.config.from_email || '');
        setApiKey(data.config.api_key || '');
        setSmtpHost(data.config.smtp_host || '');
        setSmtpPort(data.config.smtp_port ? String(data.config.smtp_port) : '587');
        setSmtpUser(data.config.smtp_user || '');
      }
    } catch (err) {
      console.error('Failed to load email config:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!fromName.trim() || !fromEmail.trim()) {
      toast.error('From Name and From Email are required.');
      return;
    }

    if ((provider === 'resend' || provider === 'sendgrid') && !apiKey) {
      toast.error('API Key is required for API providers.');
      return;
    }

    if (provider === 'smtp' && (!smtpHost.trim() || !smtpPort)) {
      toast.error('SMTP Host and Port are required.');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          from_name: fromName,
          from_email: fromEmail,
          api_key: apiKey,
          smtp_host: smtpHost,
          smtp_port: smtpPort,
          smtp_user: smtpUser,
          smtp_pass: smtpPass,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save email settings.');
        return;
      }

      toast.success('Email provider configuration saved successfully!');
      setConfigured(true);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('An error occurred while saving email configuration.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4 max-w-4xl">
      <Alert className="bg-slate-900 border-slate-700">
        <div className="flex items-center gap-2">
          {configured ? (
            <CheckCircle2 className="size-4 text-emerald-400" />
          ) : (
            <Mail className="size-4 text-primary" />
          )}
          <AlertTitle className="text-white mb-0">
            {configured ? 'Email Integration Configured' : 'Configure Email Gateway'}
          </AlertTitle>
        </div>
        <AlertDescription className="text-slate-400">
          Connect Resend, SendGrid, or custom SMTP server to power email drip campaigns and multi-channel automations.
        </AlertDescription>
      </Alert>

      <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Mail className="size-5 text-primary" /> Email Gateway Settings
          </CardTitle>
          <CardDescription className="text-slate-400">
            Select your provider and input authorization credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label className="text-slate-300">Select Provider</Label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'resend', label: 'Resend', icon: Key },
                { id: 'sendgrid', label: 'SendGrid', icon: Key },
                { id: 'smtp', label: 'Custom SMTP', icon: Server },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setProvider(id as Provider)}
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all ${
                    provider === id
                      ? 'border-primary bg-primary/10 text-white font-medium'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <Icon className="size-5 mb-2 text-primary" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* From Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Sender Name</Label>
              <Input
                placeholder="e.g. Acme Admissions / Sales Team"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Sender Email</Label>
              <Input
                type="email"
                placeholder="e.g. hello@yourdomain.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* API Key for Resend / SendGrid */}
          {(provider === 'resend' || provider === 'sendgrid') && (
            <div className="space-y-2">
              <Label className="text-slate-300">{provider === 'resend' ? 'Resend' : 'SendGrid'} API Key</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="re_123456789..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Custom SMTP Details */}
          {provider === 'smtp' && (
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">SMTP Host</Label>
                  <Input
                    placeholder="smtp.gmail.com or smtp.mailgun.org"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">SMTP Port</Label>
                  <Input
                    type="number"
                    placeholder="587"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">SMTP Username</Label>
                  <Input
                    placeholder="User or App ID"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">SMTP Password</Label>
                  <Input
                    type="password"
                    placeholder="Password or App Passcode"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving Email Settings...
                </>
              ) : (
                'Save Email Configuration'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
