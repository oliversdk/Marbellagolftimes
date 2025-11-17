import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";

const CourseDetail = lazy(() => import("@/pages/CourseDetail"));
const Admin = lazy(() => import("@/pages/Admin"));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" data-testid="loading-fallback">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" data-testid="loading-spinner" />
        <p className="text-sm text-muted-foreground" data-testid="loading-text">Loading...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin">
        <Suspense fallback={<LoadingFallback />}>
          <Admin />
        </Suspense>
      </Route>
      <Route path="/course/:id">
        <Suspense fallback={<LoadingFallback />}>
          <CourseDetail />
        </Suspense>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <FavoritesProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </FavoritesProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
