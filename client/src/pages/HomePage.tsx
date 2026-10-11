import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Recycle, ArrowLeftRight, Truck } from 'lucide-react';

export function HomePage() {
  return (
    <div className="container mx-auto px-4 py-14 text-center sm:py-20">
      <div className="mx-auto max-w-3xl">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Recycle className="h-7 w-7" />
        </span>
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Smarter e-waste management</p>
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Give Your <span className="text-primary">E-Waste</span> a Responsible Next Step
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Compare device buyback estimates or arrange a responsible recycling pickup for electronics you no longer need.
        </p>
        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg" className="shadow-sm shadow-primary/15">
            <Link to="/signup">Get Started for Free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/login">I have an account</Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-4 text-left sm:grid-cols-2 md:mt-20 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm shadow-slate-950/[0.03]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Truck className="h-6 w-6 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Easy Pickup</h3>
          <p className="text-sm leading-6 text-muted-foreground">Schedule a free pickup for your e-waste right from your doorstep at your convenience.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm shadow-slate-950/[0.03]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <ArrowLeftRight className="h-6 w-6 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Device Buyback</h3>
          <p className="text-sm leading-6 text-muted-foreground">Compare vendor estimates and approve a final price only after device inspection.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm shadow-slate-950/[0.03] sm:col-span-2 md:col-span-1">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Recycle className="h-6 w-6 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Help the Planet</h3>
          <p className="text-sm leading-6 text-muted-foreground">By recycling your e-waste, you help reduce pollution and conserve valuable natural resources.</p>
        </div>
      </div>
    </div>
  );
}
