import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Recycle, LogOut } from 'lucide-react';

export function Navbar() {
  const { session, logout, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-primary">
          <Recycle className="h-6 w-6" />
          <span className="hidden font-bold sm:inline-block">
            E-Waste Recycler
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          {isLoading ? (
            <div className="h-8 w-24 animate-pulse rounded-md bg-muted"></div>
          ) : session ? (
            <>
              <span className="hidden sm:inline text-sm text-muted-foreground">Welcome, {session.name}!</span>
              {session.role === 'user' && (
                <div className="hidden sm:flex items-center gap-2 bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm font-semibold">
                  <span>Points:</span>
                  <span className="text-primary">{session.points}</span>
                </div>
              )}
              
              {session.role === 'user' && <Link to="/dashboard"><Button variant="ghost">Dashboard</Button></Link>}
              {session.role === 'user' && <Link to="/ai-detection"><Button variant="ghost">AI Detection</Button></Link>}
              {session.role === 'vendor' && <Link to="/vendor/dashboard"><Button variant="ghost">Dashboard</Button></Link>}
              {session.role === 'admin' && <Link to="/admin/dashboard"><Button variant="ghost">Admin Panel</Button></Link>}
              
              <Button onClick={handleLogout} variant="ghost" size="icon" title="Logout">
                  <LogOut className="h-5 w-5" />
                  <span className="sr-only">Logout</span>
              </Button>
            </>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost">Login</Button></Link>
              <Link to="/signup"><Button variant="default">Sign Up</Button></Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
