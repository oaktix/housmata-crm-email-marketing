// Script to seed hello@housmata.com as admin in Supabase
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const envPath = path.join(__dirname, '../../.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env.local file not found at:', envPath);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    process.env[key] = val;
  });
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function seedAdmin() {
  const adminEmail = 'hello@housmata.com';
  const adminPassword = 'HousmataAdmin2026!'; // Default secure password
  const adminName = 'Housmata Admin';

  console.log(`Checking if admin user ${adminEmail} exists...`);

  try {
    // 1. Check if user exists in staff_members
    const { data: existingStaff, error: staffErr } = await supabase
      .from('staff_members')
      .select('*')
      .eq('email', adminEmail)
      .maybeSingle();

    if (staffErr) {
      console.error('Error querying staff_members:', staffErr.message);
    }

    if (existingStaff) {
      console.log(`Admin staff member already exists in public.staff_members (ID: ${existingStaff.id}, Role: ${existingStaff.role}).`);
      return;
    }

    // 2. Since staff doesn't exist, check or create in auth.users
    // We list users using admin API to find if email already exists
    const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) {
      console.error('Error listing auth users:', listErr.message);
      return;
    }

    let authUser = userList.users.find(u => u.email === adminEmail);

    if (!authUser) {
      console.log(`Creating auth user for ${adminEmail} using admin auth...`);
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: { name: adminName }
      });

      if (createErr) {
        console.error('Error creating auth user:', createErr.message);
        return;
      }

      authUser = newUser.user;
      console.log(`Auth user created successfully with ID: ${authUser.id}`);
      console.log(`DEFAULT PASSWORD SET: ${adminPassword}`);
    } else {
      console.log(`Auth user already exists with ID: ${authUser.id}`);
    }

    // 3. Upsert into public.staff_members
    console.log(`Adding ${adminEmail} to public.staff_members with admin role...`);
    const { data: staffData, error: upsertErr } = await supabase
      .from('staff_members')
      .upsert({
        id: authUser.id,
        email: adminEmail,
        name: adminName,
        role: 'admin',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (upsertErr) {
      console.error('Error seeding public.staff_members record:', upsertErr.message);
    } else {
      console.log('SUCCESS! Admin account seeded in staff_members:', staffData);
    }
  } catch (err) {
    console.error('General crash:', err.message);
  }
}

seedAdmin();
