import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import authService from '../services/auth.service';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verify token validity on app load and when app regains focus
  const verifyAndRestoreSession = async () => {
    try {
      const currentUser = authService.getCurrentUser();
      const token = authService.getToken();
      
      // If we have both user and token, verify the token is still valid
      if (currentUser && token) {
        const isTokenValid = await authService.verifyToken();
        
        if (isTokenValid) {
          setUser(currentUser);
        } else {
          // Token is expired or invalid - clear everything
          authService.logout();
          setUser(null);
        }
      } else {
        // No user or token - clean up any partial auth state
        if (currentUser && !token) {
          authService.logout();
        }
        setUser(null);
      }
    } catch (error) {
      // On error, clear auth state to be safe
      authService.logout();
      setUser(null);
    }
  };

  useEffect(() => {
    // Verify session on app load
    verifyAndRestoreSession().finally(() => {
      setLoading(false);
    });
  }, []);

  // Also verify when the app regains focus (user returns after being idle)
  useEffect(() => {
    const handleFocus = () => {
      // Re-verify token when app comes to focus
      verifyAndRestoreSession();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    setUser(response.user);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const value = {
    user,
    isAuthenticated: !!user && !!authService.getToken(),
    login,
    logout,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
