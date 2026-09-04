/**
 * Audience filters CRUD endpoints
 * GET /api/audience/filters - list all filters
 * POST /api/audience/filters - create new filter
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AudienceSegmentation, validateFilterConfig } from '@/lib/contacts/segmentation';
import type { AudienceFilterConfig } from '@/types';

interface FilterBody {
  name: string;
  description?: string;
  filter_config: AudienceFilterConfig;
  is_public?: boolean;
}

/**
 * GET: List all filters for user
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: filters, error } = await supabase
      .from('audience_filters')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ filters: filters || [] });
  } catch (error) {
    console.error('List filters error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST: Create new filter
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: FilterBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { name, description, filter_config, is_public = false } = body;

    // Validate
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (!filter_config) {
      return NextResponse.json({ error: 'filter_config is required' }, { status: 400 });
    }

    const errors = validateFilterConfig(filter_config);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Invalid filter config', details: errors },
        { status: 400 }
      );
    }

    // Count matching contacts (for preview)
    const segmentation = new AudienceSegmentation(supabase);
    const contact_count = await segmentation.countFilteredContacts(user.id, filter_config);

    // Create filter
    const { data: filter, error: insertError } = await supabase
      .from('audience_filters')
      .insert({
        user_id: user.id,
        name,
        description,
        filter_config,
        contact_count,
        is_public,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ filter }, { status: 201 });
  } catch (error) {
    console.error('Create filter error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
