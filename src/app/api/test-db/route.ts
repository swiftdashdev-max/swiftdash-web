import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    console.log('🔧 Testing database connection...')
    console.log('🔧 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('🔧 Anon Key (first 20 chars):', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20))

    // Test 1: Simple table query
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(5)

    console.log('🔧 Profiles query result:', { profiles, profilesError })

    // Test 2: Count query
    const { count, error: countError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    console.log('🔧 Count query result:', { count, countError })

    // Test 3: Check if table exists by trying to get schema
    const { data: schema, error: schemaError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)

    console.log('🔧 Schema test result:', { schema, schemaError })

    return NextResponse.json({
      success: true,
      tests: {
        profiles: { data: profiles, error: profilesError },
        count: { count, error: countError },
        schema: { data: schema, error: schemaError }
      },
      config: {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        keyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length
      }
    })
  } catch (error) {
    console.error('🔧 Database test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}