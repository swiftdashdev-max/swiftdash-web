import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // This will need to be added to .env.local
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Fallback to anon key if service role not available
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const userData = await request.json()

    // Validate required fields
    if (!userData.phone_number || !userData.first_name || !userData.last_name || !userData.user_type) {
      return NextResponse.json(
        { error: 'Missing required fields: phone_number, first_name, last_name, user_type' },
        { status: 400 }
      )
    }

    // Validate user type
    const validUserTypes = ['customer', 'driver', 'business', 'crm', 'admin']
    if (!validUserTypes.includes(userData.user_type)) {
      return NextResponse.json(
        { error: 'Invalid user type' },
        { status: 400 }
      )
    }

    // Check if phone number already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('user_profiles')
      .select('phone_number')
      .eq('phone_number', userData.phone_number)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing user:', checkError)
      return NextResponse.json(
        { error: 'Database error while checking existing user' },
        { status: 500 }
      )
    }

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this phone number already exists' },
        { status: 409 }
      )
    }

    // Generate email if not provided (required for Supabase Auth)
    const email = userData.email || `${userData.phone_number.replace('+', '')}@temp.swiftdash.com`
    const tempPassword = 'TempPass123!' // Temporary password, user can reset it later

    let authUser;
    let newUser;

    try {
      // Create user with admin client (auto-confirmed)
      console.log('Creating authenticated user with admin privileges...')
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        phone: userData.phone_number,
        email_confirm: true, // Auto-confirm email
        phone_confirm: true, // Auto-confirm phone
        user_metadata: {
          first_name: userData.first_name,
          last_name: userData.last_name,
          user_type: userData.user_type,
          business_name: userData.business_name
        }
      })

      if (authError) {
        console.error('Error creating auth user:', authError)
        throw new Error(`Auth creation failed: ${authError.message}`)
      }

      authUser = authData.user
      console.log('✅ Auth user created successfully:', authUser?.id)

      if (!authUser) {
        throw new Error('Auth user creation returned null')
      }

      // The user profile should be automatically created by a database trigger
      // Let's check if it exists first, then create it if it doesn't
      const { data: existingProfile, error: checkProfileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (checkProfileError && checkProfileError.code === 'PGRST116') {
        // Profile doesn't exist, create it manually
        console.log('Creating user profile manually...')
        const userProfileData = {
          id: authUser.id,
          phone_number: userData.phone_number,
          first_name: userData.first_name,
          last_name: userData.last_name,
          user_type: userData.user_type,
          status: userData.status || 'active',
          business_name: userData.business_name || null,
          profile_image_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .insert([userProfileData])
          .select()
          .single()

        if (profileError) {
          console.error('Error creating user profile:', profileError)
          // Clean up auth user if profile creation fails
          await supabaseAdmin.auth.admin.deleteUser(authUser.id)
          throw new Error(`Profile creation failed: ${profileError.message}`)
        }

        newUser = profileData
        console.log('✅ User profile created successfully')
      } else if (checkProfileError) {
        console.error('Error checking user profile:', checkProfileError)
        throw new Error(`Profile check failed: ${checkProfileError.message}`)
      } else {
        // Profile already exists (created by trigger)
        newUser = existingProfile
        console.log('✅ User profile already exists (created by trigger)')
      }

    } catch (error) {
      console.error('❌ Error in user creation process:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to create user account' },
        { status: 500 }
      )
    }

    // If user is a driver, create driver profile
    if (userData.user_type === 'driver') {
      const { error: driverError } = await supabase
        .from('driver_profiles')
        .insert([{
          user_id: newUser.id,
          is_verified: false,
          is_online: false,
          rating: 5.0,
          total_deliveries: 0,
          vehicle_type_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])

      if (driverError) {
        console.error('Error creating driver profile:', driverError)
        // Don't fail the request, but log the error
      }
    }

    console.log('User created successfully:', {
      id: newUser.id,
      name: `${newUser.first_name} ${newUser.last_name}`,
      type: newUser.user_type,
      phone: newUser.phone_number,
      email: email
    })

    return NextResponse.json({
      success: true,
      user: newUser,
      credentials: {
        email: email,
        password: tempPassword,
        isTemporaryEmail: !userData.email // Flag to indicate if email was auto-generated
      },
      message: `${userData.user_type} account created successfully`
    })

  } catch (error) {
    console.error('API error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve users (optional, can be used for testing)
export async function GET() {
  try {
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      users,
      total: users.length
    })

  } catch (error) {
    console.error('API error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}