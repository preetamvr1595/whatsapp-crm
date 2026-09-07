import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: config, error } = await supabase
      .from('email_config')
      .select('id, provider, from_name, from_email, api_key, smtp_host, smtp_port, smtp_user, created_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching email_config:', error);
      return NextResponse.json({ error: 'Failed to fetch email configuration' }, { status: 500 });
    }

    if (!config) {
      return NextResponse.json({ configured: false }, { status: 200 });
    }

    // Mask sensitive API Key / Pass for client security
    return NextResponse.json({
      configured: true,
      config: {
        ...config,
        api_key: config.api_key ? '••••••••••••••••' : null,
      },
    });
  } catch (error) {
    console.error('Error in email/config GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, from_name, from_email, api_key, smtp_host, smtp_port, smtp_user, smtp_pass } = body;

    if (!provider || !from_name || !from_email) {
      return NextResponse.json(
        { error: 'Provider, From Name, and From Email are required.' },
        { status: 400 }
      );
    }

    if (provider === 'smtp' && (!smtp_host || !smtp_port)) {
      return NextResponse.json(
        { error: 'SMTP host and port are required for SMTP provider.' },
        { status: 400 }
      );
    }

    // Fetch existing row to preserve existing API Key if user didn't modify masked value
    const { data: existing } = await supabase
      .from('email_config')
      .select('api_key, smtp_pass')
      .eq('user_id', user.id)
      .maybeSingle();

    const finalApiKey = api_key && api_key !== '••••••••••••••••' ? api_key : existing?.api_key || null;
    const finalSmtpPass = smtp_pass && smtp_pass !== '••••••••••••••••' ? smtp_pass : existing?.smtp_pass || null;

    const payload = {
      user_id: user.id,
      provider,
      from_name: from_name.trim(),
      from_email: from_email.trim(),
      api_key: finalApiKey,
      smtp_host: smtp_host ? smtp_host.trim() : null,
      smtp_port: smtp_port ? Number(smtp_port) : null,
      smtp_user: smtp_user ? smtp_user.trim() : null,
      smtp_pass: finalSmtpPass,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('email_config')
      .upsert(payload, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Error saving email_config:', upsertError);
      return NextResponse.json({ error: 'Failed to save email configuration' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Email configuration saved successfully' });
  } catch (error) {
    console.error('Error in email/config POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
