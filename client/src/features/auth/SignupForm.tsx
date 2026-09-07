import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from './AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function SignupForm() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<'user' | 'vendor'>('user');
  const [city, setCity] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const body = {
        name, email, password, role,
        ...(role === 'vendor' && { city, address, latitude: 0, longitude: 0 }) // Placeholder lat/lng
    };

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to sign up');

      login(data);
      toast({
        title: 'Signup Successful!',
        description: 'Welcome to E-Waste Recycler!',
      });

      // Redirect based on role
      if (data.role === 'vendor') {
        navigate('/vendor/dashboard');
      } else {
        navigate('/dashboard');
      }

    } catch (error) {
      toast({
        title: 'Signup Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role">I am a...</Label>
            <Select onValueChange={(value: 'user' | 'vendor') => setRole(value)} defaultValue={role}>
                <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="user">User (I want to recycle e-waste)</SelectItem>
                    <SelectItem value="vendor">Vendor (I want to collect e-waste)</SelectItem>
                </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">{role === 'vendor' ? 'Company Name' : 'Full Name'}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={role === 'vendor' ? 'Green Recyclers Inc.' : 'John Doe'} required />
          </div>

          {role === 'vendor' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Industrial Area, Chembur" required />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john.doe@example.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating Account...' : 'Sign Up'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
