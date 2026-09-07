import * as React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { Navbar } from '@/components/Navbar';
import { AIDetectionPage } from '@/pages/AIDetectionPage';
import { VendorDashboardPage } from '@/pages/VendorDashboardPage';
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-background">
          <Navbar />
          <main>
            <AppRoutes />
          </main>
          <Toaster />
        </div>
      </Router>
    </AuthProvider>
  );
}

function AppRoutes() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <p>Loading session...</p>
      </div>
    );
  }

  const getHomeRedirect = () => {
      if (!session) return "/";
      switch(session.role) {
          case 'admin': return "/admin/dashboard";
          case 'vendor': return "/vendor/dashboard";
          default: return "/dashboard";
      }
  }

  return (
    <Routes>
      <Route path="/" element={session ? <Navigate to={getHomeRedirect()} /> : <HomePage />} />
      
      {/* Auth Routes */}
      <Route path="/login" element={!session ? <LoginPage /> : <Navigate to={getHomeRedirect()} />} />
      <Route path="/signup" element={!session ? <SignupPage /> : <Navigate to={getHomeRedirect()} />} />
      
      {/* User Routes */}
      <Route path="/dashboard" element={session?.role === 'user' ? <DashboardPage /> : <Navigate to="/login" />} />
      <Route path="/ai-detection" element={session?.role === 'user' ? <AIDetectionPage /> : <Navigate to="/login" />} />

      {/* Vendor Routes */}
      <Route path="/vendor/dashboard" element={session?.role === 'vendor' ? <VendorDashboardPage /> : <Navigate to="/login" />} />

      {/* Admin Routes */}
      <Route path="/admin/dashboard" element={session?.role === 'admin' ? <AdminDashboardPage /> : <Navigate to="/login" />} />

      {/* Fallback Route */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
