import * as React from 'react';
import { Link } from 'react-router-dom';
import { SignupForm } from '@/features/auth/SignupForm';
import { Recycle } from 'lucide-react';

export function SignupPage() {
  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
            <div className="mb-8 text-center">
                <Recycle className="mx-auto mb-2 h-10 w-10 text-primary" />
                <h2 className="text-3xl font-bold tracking-tight">Create an Account</h2>
                <p className="text-muted-foreground">
                    Join us and start earning rewards for recycling!
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
