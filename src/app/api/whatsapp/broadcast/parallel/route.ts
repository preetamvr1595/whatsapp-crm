/**
 * Parallel broadcast endpoint
 * POST /api/whatsapp/broadcast/parallel
 * Sends broadcast to multiple recipients with configurable parallel workers
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ParallelBroadcastSender, validateParallelConfig } from '@/lib/whatsapp/parallel-sender';
import { AudienceSegmentation } from '@/lib/contacts/segmentation';
import type { ParallelBroadcastConfig, BroadcastRecipientWithParams, AudienceFilterConfig } from '@/types';

interface RequestBody {
  broadcast_id: string;
  template_name: string;
  template_language: string;
  recipients?: BroadcastRecipientWithParams[];
  filter_id?: string;
  filter_config?: AudienceFilterConfig;
  parallel_config?: ParallelBroadcastConfig;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request
    let body: RequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const {
      broadcast_id,
      template_name,
      template_language,
      recipients,
      filter_id,
      filter_config,
      parallel_config,
    } = body;

    // Validate required fields
    if (!broadcast_id || !template_name) {
      return NextResponse.json(
        { error: 'broadcast_id and template_name are required' },
        { status: 400 }
      );
    }

    // Validate parallel config
    if (parallel_config) {
      const configErrors = validateParallelConfig(parallel_config);
      if (configErrors.length > 0) {
        return NextResponse.json(
          { error: 'Invalid parallel config', details: configErrors },
          { status: 400 }
        );
      }
    }

    // Get recipients (either from direct array or from filter)
    let finalRecipients: BroadcastRecipientWithParams[] = [];

    if (recipients && recipients.length > 0) {
      finalRecipients = recipients;
    } else if (filter_id) {
      // Load saved filter
      const { data: savedFilter } = await supabase
        .from('audience_filters')
        .select('*')
        .eq('id', filter_id)
        .eq('user_id', user.id)
        .single();

      if (savedFilter) {
        const segmentation = new AudienceSegmentation(supabase);
        const contacts = await segmentation.getFilteredContacts(
          user.id,
          savedFilter.filter_config
        );
        finalRecipients = contacts.map(c => ({
          phone: c.phone,
          params: [],
        }));
      }
    } else if (filter_config) {
      // Use direct filter config
      const segmentation = new AudienceSegmentation(supabase);
      const contacts = await segmentation.getFilteredContacts(user.id, filter_config);
      finalRecipients = contacts.map(c => ({
        phone: c.phone,
        params: [],
      }));
    }

    if (finalRecipients.length === 0) {
      return NextResponse.json(
        { error: 'No recipients found' },
        { status: 400 }
      );
    }

    // Create sender instance
    const sender = new ParallelBroadcastSender(supabase, parallel_config);

    // Send broadcast (async - don't wait)
    sendBroadcastAsync(
      sender,
      broadcast_id,
      finalRecipients,
      template_name,
      template_language || 'en_US',
      user.id
    ).catch(error => {
      console.error('Async broadcast error:', error);
    });

    // Return immediately
    return NextResponse.json({
      status: 'sending',
      broadcast_id,
      recipients_count: finalRecipients.length,
      message: 'Broadcast started. You will receive updates via polling.',
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Send broadcast asynchronously
 * Runs in the background without blocking the response
 */
async function sendBroadcastAsync(
  sender: ParallelBroadcastSender,
  broadcastId: string,
  recipients: BroadcastRecipientWithParams[],
  templateName: string,
  templateLanguage: string,
  userId: string
) {
  try {
    await sender.sendBroadcast(
      broadcastId,
      recipients,
      templateName,
      templateLanguage,
      userId
    );
  } catch (error) {
    console.error('Async broadcast failed:', error);
  }
}

/**
 * GET broadcast status
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const broadcastId = searchParams.get('broadcast_id');

    if (!broadcastId) {
      return NextResponse.json(
        { error: 'broadcast_id query parameter required' },
        { status: 400 }
      );
    }

    // Get broadcast
    const { data: broadcast } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('id', broadcastId)
      .eq('user_id', user.id)
      .single();

    if (!broadcast) {
      return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 });
    }

    // Get recipient stats
    const { data: recipients } = await supabase
      .from('broadcast_recipients')
      .select('status')
      .eq('broadcast_id', broadcastId);

    const stats = {
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    };

    recipients?.forEach((r: any) => {
      if (r.status in stats) {
        stats[r.status as keyof typeof stats]++;
      }
    });

    return NextResponse.json({
      broadcast: {
        id: broadcast.id,
        status: broadcast.status,
        created_at: broadcast.created_at,
        started_at: broadcast.started_at,
        completed_at: broadcast.completed_at,
      },
      stats,
    });
  } catch (error) {
    console.error('Get broadcast status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
