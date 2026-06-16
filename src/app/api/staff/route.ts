import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';

export async function GET() {
  try {
    const { data: staff, error } = await supabaseAdmin
      .from('staff_members')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not fetch staff members, returning mock fallback:', error.message);
      // Fallback
      return NextResponse.json([
        { id: 'staff-1', email: 'admin@housmata.com', name: 'Primary Admin', role: 'admin', created_at: new Date().toISOString() },
        { id: 'staff-2', email: 'marketer@housmata.com', name: 'Campaign Designer', role: 'marketer', created_at: new Date().toISOString() }
      ]);
    }

    return NextResponse.json(staff);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, email, name, role } = await req.json();

    if (!id || !email || !name || !role) {
      return NextResponse.json({ error: 'Missing staff parameters' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('staff_members')
      .upsert({ id, email, name, role, created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Staff configuration saved', staff: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
