const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lygzxmhskkqrntnmxtbb.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5Z3p4bWhza2txcm50bm14dGJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODQ3MjQsImV4cCI6MjA3Mzg2MDcyNH0.mVMSa7d6wIa59eKbBKW7PajqMXfO2WgkWcCIjfwXiYs';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5Z3p4bWhza2txcm50bm14dGJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODI4NDcyNCwiZXhwIjoyMDczODYwNzI0fQ.S7N9G3C1rfuakPQwHcK-HgFOZAJnqAjuvLcS22uXUZ4';

async function verifyKeys() {
  console.log('🔑 Verifying Supabase API Keys\n');
  console.log('═'.repeat(70));
  
  // Test 1: Anon Key
  console.log('\n📋 Test 1: ANON KEY (Public Key)');
  console.log('Key:', ANON_KEY.substring(0, 50) + '...');
  
  try {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    
    const { data, error } = await anonClient
      .from('vehicle_types')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ ANON KEY INVALID:', error.message);
      console.log('   Error Code:', error.code);
      console.log('   Error Details:', error.details);
    } else {
      console.log('✅ ANON KEY VALID - Can query database');
    }
  } catch (err) {
    console.log('❌ ANON KEY ERROR:', err.message);
  }
  
  // Test 2: Service Role Key
  console.log('\n📋 Test 2: SERVICE ROLE KEY (Admin Key)');
  console.log('Key:', SERVICE_ROLE_KEY.substring(0, 50) + '...');
  
  try {
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    const { data, error } = await adminClient
      .from('user_profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ SERVICE ROLE KEY INVALID:', error.message);
      console.log('   Error Code:', error.code);
    } else {
      console.log('✅ SERVICE ROLE KEY VALID - Can query database');
    }
  } catch (err) {
    console.log('❌ SERVICE ROLE KEY ERROR:', err.message);
  }
  
  // Test 3: Check URL
  console.log('\n📋 Test 3: SUPABASE URL');
  console.log('URL:', SUPABASE_URL);
  
  try {
    const response = await fetch(SUPABASE_URL + '/rest/v1/', {
      headers: {
        'apikey': ANON_KEY
      }
    });
    
    if (response.ok) {
      console.log('✅ URL VALID - Server responding');
      console.log('   Status:', response.status, response.statusText);
    } else {
      console.log('❌ URL/KEY ISSUE:');
      console.log('   Status:', response.status, response.statusText);
      const text = await response.text();
      console.log('   Response:', text);
    }
  } catch (err) {
    console.log('❌ CONNECTION ERROR:', err.message);
  }
  
  // Test 4: Test Auth with Anon Key
  console.log('\n📋 Test 4: AUTH ENDPOINT with ANON KEY');
  
  try {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data, error } = await anonClient.auth.getSession();
    
    if (error) {
      console.log('❌ AUTH ERROR:', error.message);
    } else {
      console.log('✅ AUTH ENDPOINT ACCESSIBLE');
      console.log('   Session:', data.session ? 'Active' : 'None');
    }
  } catch (err) {
    console.log('❌ AUTH EXCEPTION:', err.message);
  }
  
  // Test 5: Decode JWT to check expiration
  console.log('\n📋 Test 5: JWT TOKEN ANALYSIS');
  
  try {
    const anonPayload = JSON.parse(Buffer.from(ANON_KEY.split('.')[1], 'base64').toString());
    const servicePayload = JSON.parse(Buffer.from(SERVICE_ROLE_KEY.split('.')[1], 'base64').toString());
    
    console.log('\n   ANON KEY Payload:');
    console.log('   - Role:', anonPayload.role);
    console.log('   - Issued:', new Date(anonPayload.iat * 1000).toLocaleString());
    console.log('   - Expires:', new Date(anonPayload.exp * 1000).toLocaleString());
    console.log('   - Is Expired:', Date.now() > anonPayload.exp * 1000 ? '❌ YES' : '✅ NO');
    
    console.log('\n   SERVICE ROLE KEY Payload:');
    console.log('   - Role:', servicePayload.role);
    console.log('   - Issued:', new Date(servicePayload.iat * 1000).toLocaleString());
    console.log('   - Expires:', new Date(servicePayload.exp * 1000).toLocaleString());
    console.log('   - Is Expired:', Date.now() > servicePayload.exp * 1000 ? '❌ YES' : '✅ NO');
    
  } catch (err) {
    console.log('❌ JWT DECODE ERROR:', err.message);
  }
  
  console.log('\n\n' + '═'.repeat(70));
  console.log('🔍 DIAGNOSIS:');
  console.log('═'.repeat(70));
  
  // Check if keys might be regenerated
  console.log('\n⚠️  If keys are invalid, they may have been regenerated.');
  console.log('   To get current keys:');
  console.log('   1. Go to: https://supabase.com/dashboard/project/lygzxmhskkqrntnmxtbb/settings/api');
  console.log('   2. Copy the "anon" key');
  console.log('   3. Copy the "service_role" key');
  console.log('   4. Update .env.local file\n');
}

verifyKeys().catch(console.error);
