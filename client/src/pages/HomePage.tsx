import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Recycle, Award, Truck } from 'lucide-react';

export function HomePage() {
  return (
    <div className="container mx-auto px-4 py-16 sm:py-24 text-center">
      <div className="max-w-3xl mx-auto">
        <Recycle className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground mb-4">
          Turn Your <span className="text-primary">E-Waste</span> into <span className="text-primary">Rewards</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-10">
          Effortlessly schedule pickups for your old electronics, earn points for every item recycled, and contribute to a greener planet.
        </p>
        <div className="flex justify-center items-center gap-4">
          <Link to="/signup">
            <Button size="lg" className="shadow-lg shadow-primary/20">Get Started for Free</Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="ghost">
              I have an account
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-12 text-left">
        <div className="flex flex-col items-center text-center">
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Easy Pickup</h3>
          <p className="text-muted-foreground">Schedule a free pickup for your e-waste right from your doorstep at your convenience.</p>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <Award className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Earn Rewards</h3>
          <p className="text-muted-foreground">Get rewarded with points for every electronic item you recycle with us. Redeem them for cool perks!</p>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <Recycle className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Help the Planet</h3>
          <p className="text-muted-foreground">By recycling your e-waste, you help reduce pollution and conserve valuable natural resources.</p>
        </div>
      </div>
    </div>
  );
}
