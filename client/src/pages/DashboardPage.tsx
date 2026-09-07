import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { PickupList } from '@/features/pickups/PickupList';
import { PickupForm } from '@/features/pickups/PickupForm';
import { useAuth } from '@/features/auth/AuthContext';
import { Award, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function DashboardPage() {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const handlePickupRequested = () => {
    setRefreshKey(prevKey => prevKey + 1);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {session?.name}!</h1>
          <p className="text-muted-foreground">Here's your e-waste recycling dashboard.</p>
        </div>
        <div className="flex items-center gap-4">
            <Card className="w-full sm:w-auto">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reward Points</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{session?.points}</div>
                <p className="text-xs text-muted-foreground">Earn more by recycling!</p>
              </CardContent>
            </Card>
            <Button onClick={handleLogout} variant="secondary" size="icon" className="h-10 w-10 shrink-0">
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Logout</span>
            </Button>
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold mb-4">Schedule a New Pickup</h2>
          <p className="text-muted-foreground mb-6">
            Earn <span className="font-bold text-primary">10 points</span> for each scheduled pickup!
          </p>
          <PickupForm onPickupRequested={handlePickupRequested} />
        </div>
        <div className="lg:col-span-3">
          <h2 className="text-2xl font-bold mb-4">Your Pickup History</h2>
          <PickupList key={refreshKey} />
        </div>
      </div>
    </div>
  );
}

