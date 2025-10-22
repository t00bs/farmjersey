import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import GrantApplication from "@/pages/grant-application";
import AdminDashboard from "@/pages/admin-dashboard";
import AgriculturalFormBuilder from "@/pages/agricultural-form-builder";

function LoginRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Only redirect to login if we've finished loading and user is not authenticated
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/api/login';
    }
  }, [isLoading, isAuthenticated]);

  // Show loading spinner while checking authentication
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={LoginRedirect} />
      ) : (
        <>
          <Route path="/admin/form-builder" component={AgriculturalFormBuilder} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/application/:id" component={GrantApplication} />
          <Route path="/" component={Dashboard} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
