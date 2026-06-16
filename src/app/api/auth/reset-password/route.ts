import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';

export async function POST(req: NextRequest) {
  try {
    const { password, access_token } = await req.json();

    if (!password || !access_token) {
      return NextResponse.json({ error: 'Password and access token are required' }, { status: 400 });
    }

    // 1. Verify user token by calling getUser (this validates JWT with Supabase Auth)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(access_token);

    if (authError || !user) {
      return NextResponse.json({ error: authError?.message || 'Invalid or expired access token' }, { status: 401 });
    }

    // 2. Perform secure password update using the verified user's ID
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password,
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Your password has been reset successfully.' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
