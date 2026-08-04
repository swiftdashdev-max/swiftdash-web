'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

/**
 * 'delivery' is the ordinary SwiftDash business. 'emergency' is a command
 * center (RCERT and the like) — same account table, different navigation and
 * a different set of pages.
 */
export type AccountType = 'delivery' | 'emergency';

interface UserContextType {
  user: User | null;
  businessId: string | null;
  accountType: AccountType | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  businessId: null,
  accountType: null,
  loading: true,
  refreshUser: async () => {},
});

export const useUserContext = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used within UserProvider');
  }
  return context;
};

export function UserProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser) {
        setUser(authUser);

        // Fetch business_id once
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('business_id')
          .eq('id', authUser.id)
          .single();

        setBusinessId(profile?.business_id || null);

        // The account type drives which navigation the shell renders, so it is
        // read here rather than in each page that needs to know.
        if (profile?.business_id) {
          const { data: account } = await supabase
            .from('business_accounts')
            .select('account_type')
            .eq('id', profile.business_id)
            .single();

          setAccountType(account?.account_type === 'emergency' ? 'emergency' : 'delivery');
        } else {
          setAccountType(null);
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUser();
      } else {
        setUser(null);
        setBusinessId(null);
        setAccountType(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        businessId,
        accountType,
        loading,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
