const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function exploreDatabaseSchema() {
  console.log('🔍 Exploring Supabase Database Schema...\n');
  
  // Get all data from user_profiles
  console.log('--- USER_PROFILES (ALL DATA) ---');
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at');
      
    if (error) {
      console.log(`❌ Error: ${error.message}`);
    } else {
      console.log(`✅ Total records: ${data.length}`);
      data.forEach((user, index) => {
        console.log(`\n${index + 1}. User: ${user.first_name} ${user.last_name}`);
        console.log(`   Type: ${user.user_type}`);
        console.log(`   Phone: ${user.phone_number}`);
        console.log(`   Status: ${user.status}`);
        console.log(`   Business: ${user.business_name || 'N/A'}`);
        console.log(`   Created: ${user.created_at}`);
      });
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
  
  console.log('\n--- DELIVERIES TABLE ---');
  try {
    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .limit(5);
      
    if (error) {
      console.log(`❌ Error: ${error.message}`);
    } else if (data.length > 0) {
      console.log(`✅ Found ${data.length} deliveries`);
      console.log('Sample delivery:', JSON.stringify(data[0], null, 2));
    } else {
      console.log('📝 Deliveries table is empty');
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
  
  // Check what other tables might exist
  console.log('\n--- CHECKING OTHER POSSIBLE TABLES ---');
  const otherTables = ['businesses', 'drivers', 'orders', 'reports', 'transactions', 'payments'];
  
  for (const tableName of otherTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
        
      if (!error) {
        console.log(`✅ ${tableName}: ${data.length > 0 ? `${data.length} records` : 'empty'}`);
      }
    } catch (err) {
      // Table doesn't exist, skip
    }
  }
}

exploreDatabaseSchema();