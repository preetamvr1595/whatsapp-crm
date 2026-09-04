/**
 * Individual filter endpoints
 * GET /api/audience/filters/[id] - get single filter
 * PATCH /api/audience/filters/[id] - update filter
 * DELETE /api/audience/filters/[id] - delete filter
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Params {
  id: string;
}

/**
 * GET: Get single filter
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: filter } = await supabase
      .from('audience_filters')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!filter) {
      return NextResponse.json({ error: 'Filter not found' }, { status: 404 });
    }

    return NextResponse.json({ filter });
  } catch (error) {
    console.error('Get filter error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update filter
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const { data: filter, error: updateError } = await supabase
      .from('audience_filters')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ filter });
  } catch (error) {
    console.error('Update filter error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete filter
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error: deleteError } = await supabase
      .from('audience_filters')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ status: 'deleted' });
  } catch (error) {
    console.error('Delete filter error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
