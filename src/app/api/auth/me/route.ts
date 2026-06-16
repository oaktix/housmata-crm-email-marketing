import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('housmata_session');

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const sessionData = JSON.parse(sessionCookie.value);

    return NextResponse.json({
      authenticated: true,
      user: sessionData.user,
    });
  } catch (err) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
