import * as React from 'react';
import { Link } from 'react-router-dom';
import { SignupForm } from '@/features/auth/SignupForm';
import { Recycle } from 'lucide-react';

export function SignupPage() {
  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md">
            <div className="mb-8 text-center">
                <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Recycle className="h-6 w-6" />
                </span>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Create an Account</h1>
                <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                    Join us to compare buyback offers and arrange responsible recycling pickups.
                </p>
            </div>
            <SignupForm />
            <p className="mt-6 px-8 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                to="/login"
                className="underline underline-offset-4 hover:text-primary"
                >
                Login
                </Link>
            </p>
        </div>
    </div>
  );
}
