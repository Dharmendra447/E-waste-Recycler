import * as React from 'react';
import { Link } from 'react-router-dom';
import { LoginForm } from '../features/auth/LoginForm';
import { Recycle } from 'lucide-react';

export function LoginPage() {
  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Recycle className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Welcome Back!</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Sign in to continue your recycling journey.
            </p>
        </div>
        <LoginForm />
         <p className="mt-6 px-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="underline underline-offset-4 hover:text-primary"
            >
              Sign Up
            </Link>
          </p>
      </div>
    </div>
  );
}
