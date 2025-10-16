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

async function getDetailedSchema() {
  console.log('📊 DETAILED DATABASE SCHEMA ANALYSIS\n');
  console.log('═'.repeat(80));
  
  // Get sample data from key tables
  const tables = [
    { name: 'user_profiles', sample: true },
    { name: 'driver_profiles', sample: true },
    { name: 'driver_verification_submissions', sample: false },
    { name: 'vehicle_types', sample: true },
    { name: 'deliveries', sample: true }
  ];
  
  for (const table of tables) {
    console.log(`\n\n📁 TABLE: ${table.name.toUpperCase()}`);
    console.log('─'.repeat(80));
    
    const { data, error, count } = await supabase
      .from(table.name)
      .select('*', { count: 'exact' })
      .limit(table.sample ? 2 : 0);
    
    if (error) {
      console.log(`❌ Error: ${error.message}`);
      continue;
    }
    
    console.log(`\n📈 Total Rows: ${count}`);
    
    if (data && data.length > 0) {
      console.log(`\n🔑 Columns (${Object.keys(data[0]).length}):`);
      
      const sampleRow = data[0];
      for (const [key, value] of Object.entries(sampleRow)) {
        const valueType = value === null ? 'NULL' : typeof value;
        const displayValue = value === null ? 'null' : 
                           typeof value === 'object' ? JSON.stringify(value).substring(0, 50) + '...' :
                           String(value).length > 50 ? String(value).substring(0, 50) + '...' :
                           value;
        console.log(`   • ${key.padEnd(30)} [${valueType.padEnd(8)}] = ${displayValue}`);
      }
      
      if (table.sample && data.length > 1) {
        console.log(`\n📝 Sample Record 2:`);
        const sampleRow2 = data[1];
        console.log(JSON.stringify(sampleRow2, null, 2).substring(0, 500));
      }
    } else {
      console.log('\n⚠️  No data in this table');
    }
  }
  
  // Check for foreign keys and relationships
  console.log('\n\n🔗 RELATIONSHIPS & CONSTRAINTS');
  console.log('═'.repeat(80));
  
  console.log('\n✓ Checking driver_verification_submissions structure...');
  const { data: dvsCheck } = await supabase
    .from('driver_verification_submissions')
    .select('*')
    .limit(0);
  
  if (dvsCheck !== null) {
    console.log('   Table exists but is empty (0 rows)');
  }
  
  // Check vehicle types
  console.log('\n✓ Available Vehicle Types:');
  const { data: vehicles } = await supabase
    .from('vehicle_types')
    .select('id, name, base_price, price_per_km, max_weight_kg, is_active')
    .order('name');
  
  if (vehicles) {
    vehicles.forEach(v => {
      console.log(`   • ${v.name.padEnd(15)} - ₱${v.base_price} base + ₱${v.price_per_km}/km (max ${v.max_weight_kg}kg) ${v.is_active ? '✅' : '❌'}`);
    });
  }
  
  // Check user types
  console.log('\n✓ User Types Distribution:');
  const { data: users } = await supabase
    .from('user_profiles')
    .select('user_type, status');
  
  if (users) {
    const typeCount = {};
    const statusCount = {};
    users.forEach(u => {
      typeCount[u.user_type] = (typeCount[u.user_type] || 0) + 1;
      statusCount[u.status] = (statusCount[u.status] || 0) + 1;
    });
    
    console.log('\n   By Type:');
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`      ${type.padEnd(12)}: ${count}`);
    });
    
    console.log('\n   By Status:');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`      ${status.padEnd(12)}: ${count}`);
    });
  }
  
  // Check delivery statuses
  console.log('\n✓ Delivery Status Distribution:');
  const { data: deliveries } = await supabase
    .from('deliveries')
    .select('status, is_multi_stop, payment_status');
  
  if (deliveries) {
    const statusCount = {};
    let multiStopCount = 0;
    const paymentCount = {};
    
    deliveries.forEach(d => {
      statusCount[d.status] = (statusCount[d.status] || 0) + 1;
      if (d.is_multi_stop) multiStopCount++;
      paymentCount[d.payment_status] = (paymentCount[d.payment_status] || 0) + 1;
    });
    
    console.log('\n   By Delivery Status:');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`      ${status.padEnd(15)}: ${count}`);
    });
    
    console.log(`\n   Multi-stop deliveries: ${multiStopCount}/${deliveries.length}`);
    
    console.log('\n   By Payment Status:');
    Object.entries(paymentCount).forEach(([status, count]) => {
      console.log(`      ${status.padEnd(15)}: ${count}`);
    });
  }
}

getDetailedSchema().catch(console.error);
