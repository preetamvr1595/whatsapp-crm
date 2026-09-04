/**
 * Audience segmentation engine
 * Filters contacts based on tags, custom fields, status, etc.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { AudienceFilterConfig, Contact } from '@/types';

export class AudienceSegmentation {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get contacts matching the filter config
   */
  async getFilteredContacts(
    userId: string,
    filter: AudienceFilterConfig
  ): Promise<Contact[]> {
    let query = this.supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId);

    // Apply tag filters
    if (filter.tags && filter.tags.tag_ids && filter.tags.tag_ids.length > 0) {
      query = await this.applyTagFilter(query, filter.tags);
    }

    // Apply custom field filters
    if (filter.custom_fields && filter.custom_fields.length > 0) {
      query = await this.applyCustomFieldFilter(query, filter.custom_fields);
    }

    // Apply contact status filter
    if (filter.contact_status && filter.contact_status.length > 0) {
      query = query.in('status', filter.contact_status);
    }

    // Apply conversation status filter
    if (filter.conversation_status && filter.conversation_status.length > 0) {
      const { data: conversationIds } = await this.supabase
        .from('conversations')
        .select('contact_id')
        .in('status', filter.conversation_status);
      
      const ids = conversationIds?.map(c => c.contact_id).filter(Boolean) || [];
      query = query.in('id', ids);
    }

    // Apply date ranges
    if (filter.created_date_range) {
      query = query
        .gte('created_at', filter.created_date_range.from)
        .lte('created_at', filter.created_date_range.to);
    }

    // Apply pipeline/deal filters
    if (filter.pipeline_stages && filter.pipeline_stages.length > 0) {
      const { data: dealIds } = await this.supabase
        .from('deals')
        .select('contact_id')
        .in('stage_id', filter.pipeline_stages)
        .eq('status', 'open');
      
      const ids = dealIds?.map(d => d.contact_id).filter(Boolean) || [];
      query = query.in('id', ids);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to filter contacts: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Count contacts matching filter
   */
  async countFilteredContacts(
    userId: string,
    filter: AudienceFilterConfig
  ): Promise<number> {
    const contacts = await this.getFilteredContacts(userId, filter);
    return contacts.length;
  }

  /**
   * Get contact count by filter for preview
   */
  async previewFilter(
    userId: string,
    filter: AudienceFilterConfig
  ): Promise<{
    total_contacts: number;
    matching_contacts: number;
    percentage: number;
  }> {
    const { count: total } = await this.supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const matching = await this.countFilteredContacts(userId, filter);

    return {
      total_contacts: total || 0,
      matching_contacts: matching,
      percentage: total ? (matching / total) * 100 : 0,
    };
  }

  /**
   * Private: Apply tag filter
   */
  private async applyTagFilter(
    query: any,
    tagFilter: { mode: string; tag_ids: string[] }
  ) {
    const { data: contactIds } = await this.supabase
      .from('contact_tags')
      .select('contact_id')
      .in('tag_id', tagFilter.tag_ids);

    const ids = contactIds?.map(c => c.contact_id).filter(Boolean) || [];

    if (tagFilter.mode === 'exclude') {
      return ids.length > 0 ? query.not('id', 'in', `(${ids.join(',')})`) : query;
    } else {
      return query.in('id', ids);
    }
  }

  /**
   * Private: Apply custom field filter
   */
  private async applyCustomFieldFilter(
    query: any,
    fields: Array<{ field_id: string; operator: string; value: any }>
  ) {
    for (const field of fields) {
      const columnName = `custom_fields->>${field.field_id}`;

      switch (field.operator) {
        case '=':
          query = query.eq(columnName, String(field.value));
          break;
        case '!=':
          query = query.neq(columnName, String(field.value));
          break;
        case '>':
          query = query.gt(columnName, String(field.value));
          break;
        case '<':
          query = query.lt(columnName, String(field.value));
          break;
        case 'contains':
          query = query.ilike(columnName, `%${field.value}%`);
          break;
        case 'in':
          const values = Array.isArray(field.value) ? field.value : [field.value];
          query = query.in(columnName, values);
          break;
      }
    }

    return query;
  }
}

/**
 * Helper to create a default filter (select all contacts)
 */
export function createDefaultFilter(): AudienceFilterConfig {
  return {};
}

/**
 * Helper to validate filter config
 */
export function validateFilterConfig(filter: AudienceFilterConfig): string[] {
  const errors: string[] = [];

  if (filter.custom_fields) {
    for (const field of filter.custom_fields) {
      if (!field.field_id) errors.push('Custom field ID is required');
      if (!field.operator) errors.push('Operator is required');
      if (field.value === undefined) errors.push('Field value is required');
    }
  }

  if (filter.created_date_range) {
    if (new Date(filter.created_date_range.from) > new Date(filter.created_date_range.to)) {
      errors.push('Start date must be before end date');
    }
  }

  return errors;
}
