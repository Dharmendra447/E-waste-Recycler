import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Recycle, LogOut } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';

export function Navbar() {
  const { session, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navButtonClass = (path: string) => (
    `h-9 px-2 text-xs sm:px-3 sm:text-sm ${location.pathname === path ? 'bg-primary/10 font-semibold text-primary hover:bg-primary/15 hover:text-primary' : 'text-muted-foreground'}`
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="container mx-auto flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight text-primary">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Recycle className="h-5 w-5" />
          </span>
          <span className="text-sm sm:text-base">E-Waste Recycler</span>
        </Link>
        <nav aria-label="Main navigation" className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1">
          {isLoading ? (
            <div className="h-8 w-24 animate-pulse rounded-md bg-muted" aria-label="Loading navigation" />
          ) : session ? (
            <>
              <span className="hidden text-sm text-muted-foreground lg:inline">Welcome, {session.name}</span>
              {session.role === 'user' && (
                <>
                  <Button asChild variant="ghost" className={navButtonClass('/dashboard')}>
                    <Link to="/dashboard" aria-current={location.pathname === '/dashboard' ? 'page' : undefined}>Dashboard</Link>
                  </Button>
                  <Button asChild variant="ghost" className={navButtonClass('/ai-detection')}>
                    <Link to="/ai-detection" aria-current={location.pathname === '/ai-detection' ? 'page' : undefined}>AI Detection</Link>
                  </Button>
                  <Button asChild variant="ghost" className={navButtonClass('/ecoai-advisor')}>
                    <Link to="/ecoai-advisor" aria-current={location.pathname === '/ecoai-advisor' ? 'page' : undefined}>EcoAI Advisor</Link>
                  </Button>
                  <Button asChild variant="ghost" className={navButtonClass('/find-recycler')}>
                    <Link to="/find-recycler" aria-current={location.pathname === '/find-recycler' ? 'page' : undefined}>Find Recycler</Link>
                  </Button>
                </>
              )}
              {session.role === 'vendor' && (
                <Button asChild variant="ghost" className={navButtonClass('/vendor/dashboard')}>
                  <Link to="/vendor/dashboard" aria-current={location.pathname === '/vendor/dashboard' ? 'page' : undefined}>Dashboard</Link>
                </Button>
              )}
              {session.role === 'admin' && (
                <Button asChild variant="ghost" className={navButtonClass('/admin/dashboard')}>
                  <Link to="/admin/dashboard" aria-current={location.pathname === '/admin/dashboard' ? 'page' : undefined}>Admin Panel</Link>
                </Button>
              )}

              <Button onClick={handleLogout} variant="ghost" size="icon" title="Logout" aria-label="Logout">
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="h-9 px-3 text-xs sm:text-sm">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild variant="default" className="h-9 px-3 text-xs sm:text-sm">
                <Link to="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
