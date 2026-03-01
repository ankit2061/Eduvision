import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import OnboardingPage from "./pages/OnboardingPage";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import { useAuth } from "./lib/AuthProvider";
import { useMe } from "./lib/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

// ─── Auth Guards ──────────────────────────────────────────────────────────────

function ProtectedRoute({
  desiredRole,
  children
}: {
  desiredRole: string;
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { data: profile, isLoading: isProfileLoading } = useMe();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/auth" replace />;
  }

  // Role check
  if (desiredRole !== "onboarding" && desiredRole !== "admin" && user.role !== desiredRole) {
    if (user.role !== "admin") {
      return <Navigate to={`/${user.role}`} replace />;
    }
  }

  if (desiredRole === "admin" && user.role !== "admin") {
    return <Navigate to={`/${user.role}`} replace />;
  }

  if (isProfileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Onboarding enforcement
  if (desiredRole !== "admin" && desiredRole !== "onboarding" && profile && !profile.onboarding_complete) {
    return <OnboardingPage />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<AuthPage />} />

      {/* Onboarding */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute desiredRole="onboarding">
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      {/* Teacher Portal */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute desiredRole="teacher">
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />

      {/* Student Portal */}
      <Route
        path="/student"
        element={
          <ProtectedRoute desiredRole="student">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />

      {/* Admin Portal */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute desiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppRoutes />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
