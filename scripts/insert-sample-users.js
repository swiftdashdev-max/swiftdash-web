const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function insertSampleUsers() {
  console.log('🚀 Inserting sample users for testing...\n');

  const sampleUsers = [
    {
      phone_number: '+639171234567',
      first_name: 'Maria',
      last_name: 'Santos',
      user_type: 'customer',
      status: 'active'
    },
    {
      phone_number: '+639181234568',
      first_name: 'Juan',
      last_name: 'Dela Cruz',
      user_type: 'driver',
      status: 'active'
    },
    {
      phone_number: '+639191234569',
      first_name: 'Anna',
      last_name: 'Reyes',
      user_type: 'customer',
      status: 'active'
    },
    {
      phone_number: '+639201234570',
      first_name: 'Carlos',
      last_name: 'Garcia',
      user_type: 'driver',
      status: 'inactive'
    },
    {
      phone_number: '+639211234571',
      first_name: 'Sofia',
      last_name: 'Martinez',
      user_type: 'business',
      status: 'active',
      business_name: 'Sofia\'s Catering Services'
    },
    {
      phone_number: '+639221234572',
      first_name: 'Miguel',
      last_name: 'Rodriguez',
      user_type: 'customer',
      status: 'suspended'
    },
    {
      phone_number: '+639231234573',
      first_name: 'Elena',
      last_name: 'Torres',
      user_type: 'business',
      status: 'active',
      business_name: 'Torres Electronics'
    },
    {
      phone_number: '+639241234574',
      first_name: 'Roberto',
      last_name: 'Villanueva',
      user_type: 'driver',
      status: 'active'
    },
    {
      phone_number: '+639251234575',
      first_name: 'Carmen',
      last_name: 'Mendoza',
      user_type: 'customer',
      status: 'active'
    },
    {
      phone_number: '+639261234576',
      first_name: 'Diego',
      last_name: 'Morales',
      user_type: 'crm',
      status: 'active'
    }
  ];

  try {
    // Check existing users to avoid duplicates
    const { data: existingUsers } = await supabase
      .from('user_profiles')
      .select('phone_number');

    const existingPhones = new Set(existingUsers?.map(u => u.phone_number) || []);
    
    const newUsers = sampleUsers.filter(user => !existingPhones.has(user.phone_number));
    
    if (newUsers.length === 0) {
      console.log('✅ All sample users already exist!');
      return;
    }

    console.log(`📝 Inserting ${newUsers.length} new sample users...`);

    // Insert users in batches to avoid overwhelming the database
    const batchSize = 5;
    for (let i = 0; i < newUsers.length; i += batchSize) {
      const batch = newUsers.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .insert(batch)
        .select();

      if (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, error);
        continue;
      }

      console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}: ${data.length} users`);
      data.forEach(user => {
        console.log(`   - ${user.first_name} ${user.last_name} (${user.user_type})`);
      });
    }

    console.log('\n🎉 Sample users insertion completed!');
    console.log('\n💡 You can now test the Users page with real data.');
    
  } catch (error) {
    console.error('❌ Error inserting sample users:', error);
  }
}

// Run the script
insertSampleUsers();