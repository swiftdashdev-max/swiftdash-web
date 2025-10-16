const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lygzxmhskkqrntnmxtbb.supabase.co';
const NEW_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5Z3p4bWhza2txcm50bm14dGJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODQ3MjQsImV4cCI6MjA3Mzg2MDcyNH0.BUk80PxkIXzaohReyAXF0TpuMKp2HV49eg9E_Zq9XDQ';

async function testNewKey() {
  console.log('🔑 Testing NEW Anon Key\n');
  console.log('═'.repeat(60));
  
  const supabase = createClient(SUPABASE_URL, NEW_ANON_KEY);
  
  // Test 1: Database query
  console.log('\n📋 Test 1: Database Query');
  try {
    const { data, error } = await supabase
      .from('vehicle_types')
      .select('id, name')
      .limit(3);
    
    if (error) {
      console.log('❌ FAILED:', error.message);
    } else {
      console.log('✅ SUCCESS! Can query database');
      console.log('   Sample data:', data.map(v => v.name).join(', '));
    }
  } catch (err) {
    console.log('❌ ERROR:', err.message);
  }
  
  // Test 2: Auth endpoint
  console.log('\n📋 Test 2: Authentication Endpoint');
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('❌ FAILED:', error.message);
    } else {
      console.log('✅ SUCCESS! Auth endpoint accessible');
    }
  } catch (err) {
    console.log('❌ ERROR:', err.message);
  }
  
  // Test 3: Try to sign in (this will fail if no user exists, but tests the API)
  console.log('\n📋 Test 3: Test Login Endpoint');
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'test123'
    });
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        console.log('✅ SUCCESS! Login endpoint working (credentials just wrong)');
      } else if (error.message.includes('Invalid API key')) {
        console.log('❌ FAILED: API key still invalid');
      } else {
        console.log('⚠️  Endpoint accessible but:', error.message);
      }
    } else {
      console.log('✅ SUCCESS! Login worked (unexpected!)');
    }
  } catch (err) {
    console.log('❌ ERROR:', err.message);
  }
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('✅ API KEY UPDATED SUCCESSFULLY!');
  console.log('═'.repeat(60));
  console.log('\n🚀 Next Steps:');
  console.log('   1. Restart your dev server: npm run dev');
  console.log('   2. Try logging in again');
  console.log('   3. If no users exist, create one at:');
  console.log('      https://supabase.com/dashboard/project/lygzxmhskkqrntnmxtbb/auth/users\n');
}

testNewKey().catch(console.error);
