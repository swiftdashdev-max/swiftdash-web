const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lygzxmhskkqrntnmxtbb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5Z3p4bWhza2txcm50bm14dGJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODI4NDcyNCwiZXhwIjoyMDczODYwNzI0fQ.S7N9G3C1rfuakPQwHcK-HgFOZAJnqAjuvLcS22uXUZ4',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function checkRelationships() {
  console.log('🔍 Checking deliveries table relationships...\n');
  
  // Test the query that's failing
  const { data, error } = await supabase
    .from('deliveries')
    .select(`
      id,
      tracking_number,
      driver_id,
      driver_profiles!driver_id (
        *,
        user_profiles!inner (
          full_name,
          phone_number,
          avatar_url
        )
      )
    `)
    .limit(1);
    
  if (error) {
    console.error('❌ Query Error:', error);
    console.log('\nError details:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ Query successful!');
    console.log('Sample data:', JSON.stringify(data, null, 2));
  }
  
  // Check if driver_profiles has a user_id foreign key
  console.log('\n📊 Checking driver_profiles structure...');
  const { data: driverData, error: driverError } = await supabase
    .from('driver_profiles')
    .select('*')
    .limit(1);
    
  if (driverData && driverData.length > 0) {
    console.log('Driver profiles columns:', Object.keys(driverData[0]));
  }
  
  // Check user_profiles
  console.log('\n📊 Checking user_profiles structure...');
  const { data: userData, error: userError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(1);
    
  if (userData && userData.length > 0) {
    console.log('User profiles columns:', Object.keys(userData[0]));
  }
}

checkRelationships().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
