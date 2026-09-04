/**
 * Parallel broadcast sender
 * Sends messages to multiple recipients concurrently with throttling
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Throttle } from '@/lib/utils/throttle';
import type { ParallelBroadcastConfig, BroadcastRecipientWithParams } from '@/types';

interface SendResult {
  phone: string;
  success: boolean;
  messageId?: string;
  error?: string;
  retryCount: number;
}

export class ParallelBroadcastSender {
  private throttle: Throttle;
  private maxRetries: number;
  private retryDelaySeconds: number;

  constructor(
    private supabase: SupabaseClient,
    config: ParallelBroadcastConfig = {}
  ) {
    this.throttle = new Throttle(
      config.concurrent_workers || 3,
      config.delay_between_sends_ms || 500
    );
    this.maxRetries = config.max_retries || 1;
    this.retryDelaySeconds = config.retry_delay_seconds || 5;
  }

  /**
   * Send broadcast to multiple recipients in parallel
   */
  async sendBroadcast(
    broadcastId: string,
    recipients: BroadcastRecipientWithParams[],
    templateName: string,
    templateLanguage: string,
    userId: string
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: SendResult[];
  }> {
    console.log(`🚀 Starting parallel broadcast to ${recipients.length} recipients`);

    const results: SendResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Update broadcast status
    await this.supabase
      .from('broadcasts')
      .update({
        status: 'sending',
        started_at: new Date().toISOString(),
      })
      .eq('id', broadcastId);

    // Send to all recipients in parallel
    const promises = recipients.map((recipient) =>
      this.throttle.add(() =>
        this.sendToRecipient(
          broadcastId,
          recipient,
          templateName,
          templateLanguage,
          userId
        )
      )
    );

    // Wait for all to complete (don't throw on individual failures)
    const settledResults = await Promise.allSettled(promises);

    for (const settled of settledResults) {
      if (settled.status === 'fulfilled') {
        const result = settled.value;
        results.push(result);
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      } else {
        // Promise rejected
        failureCount++;
        results.push({
          phone: 'unknown',
          success: false,
          error: settled.reason?.message || 'Unknown error',
          retryCount: 0,
        });
      }
    }

    // Wait for all tasks to complete
    await this.throttle.waitAll();

    // Update broadcast with final status
    await this.supabase
      .from('broadcasts')
      .update({
        status: failureCount === 0 ? 'completed' : 'partial',
        completed_at: new Date().toISOString(),
      })
      .eq('id', broadcastId);

    console.log(
      `✅ Broadcast complete: ${successCount} sent, ${failureCount} failed`
    );

    return {
      total: recipients.length,
      successful: successCount,
      failed: failureCount,
      results,
    };
  }

  /**
   * Send message to single recipient with retry
   */
  private async sendToRecipient(
    broadcastId: string,
    recipient: BroadcastRecipientWithParams,
    templateName: string,
    templateLanguage: string,
    userId: string
  ): Promise<SendResult> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Get WhatsApp config
        const { data: config, error: configError } = await this.supabase
          .from('whatsapp_config')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (configError || !config) {
          throw new Error('WhatsApp config not found');
        }

        // Send via Meta API
        const messageId = await this.sendViaMetaAPI(
          config,
          recipient,
          templateName,
          templateLanguage
        );

        // Save to broadcast_recipients
        await this.supabase
          .from('broadcast_recipients')
          .insert({
            broadcast_id: broadcastId,
            phone_number: recipient.phone,
            status: 'sent',
            whatsapp_message_id: messageId,
          });

        console.log(`✅ Sent to ${recipient.phone}`);

        return {
          phone: recipient.phone,
          success: true,
          messageId,
          retryCount: attempt,
        };
      } catch (error) {
        const isLastAttempt = attempt === this.maxRetries;

        if (isLastAttempt) {
          console.error(`❌ Failed to send to ${recipient.phone}:`, error);

          // Save failed status
          try {
            await this.supabase
              .from('broadcast_recipients')
              .insert({
                broadcast_id: broadcastId,
                phone_number: recipient.phone,
                status: 'failed',
                error_message: error instanceof Error ? error.message : String(error),
              });
          } catch {
            // Ignore save errors
          }

          return {
            phone: recipient.phone,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            retryCount: attempt,
          };
        } else {
          // Wait before retry
          await new Promise(resolve =>
            setTimeout(resolve, this.retryDelaySeconds * 1000)
          );
        }
      }
    }

    return {
      phone: recipient.phone,
      success: false,
      error: 'Max retries exceeded',
      retryCount: this.maxRetries,
    };
  }

  /**
   * Send message via Meta WhatsApp Cloud API
   */
  private async sendViaMetaAPI(
    config: any,
    recipient: BroadcastRecipientWithParams,
    templateName: string,
    templateLanguage: string
  ): Promise<string> {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient.phone,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: templateLanguage,
            },
            components: recipient.params.length > 0 ? [
              {
                type: 'body',
                parameters: recipient.params.map(p => ({ type: 'text', text: p })),
              },
            ] : undefined,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Meta API error: ${data.error?.message || 'Unknown error'}`
      );
    }

    return data.messages[0].id;
  }
}

/**
 * Helper to validate parallel config
 */
export function validateParallelConfig(config: ParallelBroadcastConfig): string[] {
  const errors: string[] = [];

  if (config.concurrent_workers && (config.concurrent_workers < 1 || config.concurrent_workers > 10)) {
    errors.push('concurrent_workers must be between 1 and 10');
  }

  if (config.delay_between_sends_ms && (config.delay_between_sends_ms < 100 || config.delay_between_sends_ms > 5000)) {
    errors.push('delay_between_sends_ms must be between 100 and 5000ms');
  }

  if (config.max_retries && (config.max_retries < 0 || config.max_retries > 3)) {
    errors.push('max_retries must be between 0 and 3');
  }

  return errors;
}
