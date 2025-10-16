const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lygzxmhskkqrntnmxtbb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5Z3p4bWhza2txcm50bm14dGJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODQ3MjQsImV4cCI6MjA3Mzg2MDcyNH0.mVMSa7d6wIa59eKbBKW7PajqMXfO2WgkWcCIjfwXiYs'
);

async function testAuth() {
  console.log('🔍 Testing Supabase Authentication Setup\n');
  console.log('═'.repeat(60));
  
  // Test 1: Check if we can access auth
  console.log('\n📋 Test 1: Check Auth Endpoint');
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.log('❌ Auth Error:', error.message);
    } else {
      console.log('✅ Auth endpoint accessible');
      console.log('   Session:', data.session ? 'Active' : 'None');
    }
  } catch (err) {
    console.log('❌ Failed to connect:', err.message);
  }
  
  // Test 2: Try to login with test credentials
  console.log('\n📋 Test 2: Attempt Login');
  console.log('   Email: admin@swiftdash.com');
  console.log('   Password: admin123');
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@swiftdash.com',
      password: 'admin123'
    });
    
    if (error) {
      console.log('❌ Login Failed:', error.message);
      console.log('   Error Status:', error.status);
      
      if (error.status === 400) {
        console.log('\n💡 Cause: Invalid credentials or user does not exist in auth.users');
      } else if (error.status === 401) {
        console.log('\n💡 Cause: Authentication not enabled or credentials incorrect');
      } else if (error.status === 429) {
        console.log('\n💡 Cause: Too many login attempts');
      }
    } else {
      console.log('✅ Login Successful!');
      console.log('   User ID:', data.user?.id);
      console.log('   Email:', data.user?.email);
      console.log('   User Meta:', JSON.stringify(data.user?.user_metadata, null, 2));
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }
  
  // Test 3: Check user_profiles table
  console.log('\n📋 Test 3: Check user_profiles Table');
  try {
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, phone_number, first_name, last_name, user_type, status');
    
    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log(`✅ Found ${profiles.length} users in user_profiles:`);
      profiles.forEach(p => {
        console.log(`   • ${p.first_name} ${p.last_name} (${p.user_type}) - ${p.phone_number}`);
      });
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }
  
  // Test 4: Check if email provider is configured
  console.log('\n📋 Test 4: Authentication Provider Status');
  console.log('   To check providers, go to:');
  console.log('   https://supabase.com/dashboard/project/lygzxmhskkqrntnmxtbb/auth/providers');
  
  console.log('\n\n🔧 NEXT STEPS:');
  console.log('═'.repeat(60));
  console.log('1. Go to Supabase Dashboard → Authentication → Providers');
  console.log('2. Enable "Email" provider');
  console.log('3. Go to Authentication → Users');
  console.log('4. Click "Add user" and create:');
  console.log('   - Email: admin@swiftdash.com');
  console.log('   - Password: admin123');
  console.log('   - Auto Confirm: Yes');
  console.log('5. Run this script again to verify');
  console.log('\nOR use the simple admin login at:');
  console.log('http://localhost:9002/admin/login (no auth required)\n');
}

testAuth().catch(console.error);
