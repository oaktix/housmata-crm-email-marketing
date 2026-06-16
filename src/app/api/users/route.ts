import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';

export async function GET() {
  try {
    let allUsers: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: users, error } = await supabaseAdmin
        .from('User')
        .select('id, email, firstName, lastName, role')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error(`Error querying User table at page ${page}:`, error.message);
        break;
      }

      if (users && users.length > 0) {
        allUsers = [...allUsers, ...users];
        if (users.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    if (allUsers.length === 0) {
      console.log('No users found in database, returning mock fallback data');
      
      // Fallback for CRM dashboard demo/testing
      const mockUsers = [
        { id: '1', email: 'john.doe@example.com', first_name: 'John', last_name: 'Doe', role: 'parent', status: 'active' },
        { id: '2', email: 'jane.smith@example.com', first_name: 'Jane', last_name: 'Smith', role: 'teacher', status: 'active' },
        { id: '3', email: 'agent.k@example.com', first_name: 'Agent', last_name: 'K', role: 'super_admin', status: 'active' },
        { id: '4', email: 'outage-test@housmata.com', first_name: 'Outage', last_name: 'Tester', role: 'parent', status: 'active' },
      ];
      return NextResponse.json(mockUsers);
    }

    // Map keys to match the frontend expectations
    const mappedUsers = allUsers.map((u: any) => ({
      id: u.id,
      email: u.email,
      first_name: u.firstName || '',
      last_name: u.lastName || '',
      role: u.role || 'USER',
      status: 'active'
    }));

    return NextResponse.json(mappedUsers);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

