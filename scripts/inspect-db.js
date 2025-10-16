const { createClient } = require('@supabase/supabase-js');

// Using service role key for full database access
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

async function inspectDatabase() {
  console.log('🔍 Inspecting Supabase Database...\n');
  
  console.log('📋 Checking database tables...\n');
  
  const tablesToCheck = [
    'user_profiles',
    'driver_verification_submissions',
    'vehicle_types',
    'deliveries',
    'delivery_stops',
    'driver_profiles',
    'business_profiles',
    'crm_profiles'
  ];
  
  const tableResults = {};
  
  for (const table of tablesToCheck) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: false })
      .limit(1);
      
    if (!error) {
      tableResults[table] = {
        exists: true,
        count: count || 0,
        columns: data && data.length > 0 ? Object.keys(data[0]) : []
      };
    } else {
      tableResults[table] = {
        exists: false,
        error: error.message
      };
    }
  }
  
  // Display results
  console.log('📊 Database Tables Analysis:');
  console.log('═'.repeat(70));
  
  for (const [tableName, info] of Object.entries(tableResults)) {
    if (info.exists) {
      console.log(`\n✅ ${tableName}`);
      console.log(`   Rows: ${info.count}`);
      if (info.columns.length > 0) {
        console.log(`   Columns (${info.columns.length}):`);
        console.log(`   ${info.columns.join(', ')}`);
      }
    } else {
      console.log(`\n❌ ${tableName} - ${info.error}`);
    }
  }
  
  // Check storage buckets
  console.log('\n\n🗂️  Storage Buckets:');
  console.log('─'.repeat(50));
  
  const { data: buckets, error: bucketsError } = await supabase
    .storage
    .listBuckets();
  
  if (bucketsError) {
    console.log('❌ Error fetching buckets:', bucketsError);
  } else {
    buckets.forEach(bucket => {
      console.log(`✅ ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });
  }
}

inspectDatabase().catch(console.error);
