const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const envPath = path.join(__dirname, '../../.env.local');
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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectTables() {
  // Query Supabase postgrest schema info
  const { data, error } = await supabase.from('User').select('id').limit(1);
  console.log('User query:', { data, error });

  // Let's see if we can get list of tables using RPC or check if any tables like staff_members or email_campaigns exist
  const { data: staffData, error: staffErr } = await supabase.from('staff_members').select('*').limit(1);
  console.log('staff_members query:', { staffData, staffErr });
}
inspectTables();
