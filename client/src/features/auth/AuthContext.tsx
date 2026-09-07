import * as React from 'react';
import { useToast } from '@/components/ui/use-toast';

interface UserSession {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'vendor' | 'admin';
  points?: number;
  city?: string;
}

interface AuthContextType {
  session: UserSession | null;
  login: (sessionData: UserSession) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const { toast } = useToast();

  const fetchSession = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/me', {
        credentials: 'include'
      });
      if (response.ok) {
        const sessionData = await response.json();
        setSession(sessionData);
      } else {
        setSession(null);
      }
    } catch (error) {
      console.error('Failed to fetch session', error);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const login = (sessionData: UserSession) => {
    setSession(sessionData);
  };

  const logout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setSession(null);
      toast({ title: 'Logged out successfully.' });
    } catch (error) {
      toast({ title: 'Logout failed.', variant: 'destructive' });
    }
  };

  const refreshSession = async () => {
    await fetchSession();
  };

  return (
    <AuthContext.Provider value={{ session, login, logout, isLoading, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
