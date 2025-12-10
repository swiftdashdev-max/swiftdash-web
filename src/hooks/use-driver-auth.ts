'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getDriverVerificationByUserId } from '@/lib/supabase/driver-verification';

interface DriverUser {
  id: string;
  email: string;
  user_type: 'driver';
  first_name: string;
  last_name: string;
  verification_status: 'pending' | 'under_review' | 'verified' | 'rejected' | 'approved' | 'needs_revision';
  phone_number?: string;
  vehicle_type?: string;
  vehicle_type_id?: string;
  verification_submission_id?: string;
  submission_data?: any; // Store full submission data for progress restoration
}

export function useDriverAuth() {
  const [user, setUser] = useState<DriverUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    
    // Clear driver session when user closes browser/tab
    const handleBeforeUnload = () => {
      clearDriverSession();
    };

    // Clear driver session when user navigates away
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearDriverSession();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const checkAuth = async () => {
    try {
      // Check session storage instead of local storage for temporary session
      const userData = sessionStorage.getItem('driver_user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        if (parsedUser.user_type === 'driver') {
          // Check for existing verification submission
          const verificationResult = await getDriverVerificationByUserId(parsedUser.id);
          if (verificationResult.success && verificationResult.data) {
            parsedUser.verification_status = verificationResult.data.status;
            parsedUser.verification_submission_id = verificationResult.data.id;
            parsedUser.vehicle_type_id = verificationResult.data.vehicle_type_id;
            parsedUser.submission_data = verificationResult.data; // Store full submission data for progress restoration
            
            // Update session storage with latest verification status
            sessionStorage.setItem('driver_user', JSON.stringify(parsedUser));
          }
          
          setUser(parsedUser);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearDriverSession = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('driver_user');
      // Also clear any localStorage remnants
      localStorage.removeItem('driver_user');
    }
  };

  const login = async (email: string, password: string) => {
    // In production, this would call your Supabase auth
    // For now, simulate the authentication
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock authentication - in production, verify with Supabase
      if (email && password) {
        // Generate a proper UUID for the mock user
        const generateUUID = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };

        const mockUser: DriverUser = {
          id: generateUUID(), // Generate proper UUID instead of string
          email: email,
          user_type: 'driver',
          first_name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
          last_name: 'Driver',
          verification_status: 'pending',
          phone_number: '+639123456789',
        };

        // Use sessionStorage instead of localStorage for temporary session
        sessionStorage.setItem('driver_user', JSON.stringify(mockUser));
        setUser(mockUser);
        return { success: true };
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      return { success: false, error: 'Invalid email or password' };
    }
  };

  const logout = () => {
    clearDriverSession();
    setUser(null);
    router.push('/');
  };

  const updateUser = (updates: Partial<DriverUser>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      // Use sessionStorage for temporary session
      sessionStorage.setItem('driver_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  const requireAuth = () => {
    if (!isLoading && !user) {
      router.push('/driver-login');
      return false;
    }
    return true;
  };

  return {
    user,
    isLoading,
    login,
    logout,
    updateUser,
    requireAuth
  };
}