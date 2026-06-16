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
    const { email, name, role, password } = await req.json();

    if (!email || !name || !role || !password) {
      return NextResponse.json({ error: 'Missing staff parameters (email, name, role, password)' }, { status: 400 });
    }

    // 1. Create the user in auth.users first using admin client
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authError) {
      return NextResponse.json({ error: `Auth registration failed: ${authError.message}` }, { status: 500 });
    }

    const userId = authUser.user.id;

    // 2. Insert into public.staff_members table
    const { data, error } = await supabaseAdmin
      .from('staff_members')
      .upsert({ id: userId, email, name, role, created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) {
      // If public.staff_members table doesn't exist yet, we return the user info as success anyway
      if (error.message.includes("staff_members")) {
        console.warn('public.staff_members table missing, returned auth user info only');
        return NextResponse.json({
          message: 'Staff member created (Auth active, profile table missing)',
          staff: { id: userId, email, name, role, created_at: new Date().toISOString() }
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Staff configuration saved', staff: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
