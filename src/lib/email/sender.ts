import { createClient } from '@supabase/supabase-js';

// Lazy initialized admin client to read email configs securely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null;
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}

export interface SendEmailPayload {
  userId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ userId, to, subject, html, text }: SendEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Load email config for user
    const { data: config, error: configError } = await supabaseAdmin()
      .from('email_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (configError || !config) {
      return { success: false, error: 'No email gateway configuration found for this user.' };
    }

    const { provider, from_name, from_email, api_key } = config;

    if (provider === 'resend') {
      if (!api_key) return { success: false, error: 'Resend API key missing.' };

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${from_name} <${from_email}>`,
          to: [to],
          subject,
          html,
          text: text || html.replace(/<[^>]+>/g, ''),
        }),
      });

      const responseData = await res.json();
      if (!res.ok) {
        return { success: false, error: responseData.message || 'Failed to send via Resend' };
      }

      return { success: true, messageId: responseData.id };
    }

    if (provider === 'sendgrid') {
      if (!api_key) return { success: false, error: 'SendGrid API key missing.' };

      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from_email, name: from_name },
          subject,
          content: [
            { type: 'text/html', value: html },
            ...(text ? [{ type: 'text/plain', value: text }] : []),
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `SendGrid error: ${errText}` };
      }

      return { success: true, messageId: `sendgrid-${Date.now()}` };
    }

    return { success: false, error: `Provider ${provider} is not currently supported for direct fetch dispatch.` };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown email dispatch error';
    console.error('[sendEmail] Exception:', errorMsg);
    return { success: false, error: errorMsg };
  }
}
