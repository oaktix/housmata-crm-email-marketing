// Test script to verify Supabase connection using values from .env.local
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Helper to load env variables from .env.local manually
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

console.log('Connecting to Supabase:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  try {
    // Attempt to query the case-sensitive 'User' table
    const { data, error } = await supabase
      .from('User')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Database query error on User table:', error.message);
      return;
    }

    console.log('SUCCESS! Connected to Supabase User table.');
    console.log('User schema column keys available in first record:');
    if (data && data.length > 0) {
      console.log(Object.keys(data[0]));
      console.log('Sample data:', data[0]);
    } else {
      console.log('No user records found in User table, but table exists!');
    }
  } catch (err) {
    console.error('Execution crash:', err.message);
  }
}

testConnection();
