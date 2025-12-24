import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { BookingCartProvider } from "@/contexts/BookingCartContext";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { GolfLoader } from "@/components/GolfLoader";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";

const CourseDetail = lazy(() => import("@/pages/CourseDetail"));
const Admin = lazy(() => import("@/pages/Admin"));
const AdminCompanyProfile = lazy(() => import("@/pages/AdminCompanyProfile"));
const Profile = lazy(() => import("@/pages/Profile"));
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const BookingSuccess = lazy(() => import("@/pages/BookingSuccess"));
const Review = lazy(() => import("@/pages/Review"));
const TeeTimeSearch = lazy(() => import("@/pages/TeeTimeSearch"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const MyBookings = lazy(() => import("@/pages/MyBookings"));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" data-testid="loading-fallback">
      <GolfLoader size="lg" text="Loading..." />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login">
        <Suspense fallback={<LoadingFallback />}>
          <Login />
        </Suspense>
      </Route>
      <Route path="/signup">
        <Suspense fallback={<LoadingFallback />}>
          <Signup />
        </Suspense>
      </Route>
      <Route path="/admin">
        <Suspense fallback={<LoadingFallback />}>
          <Admin />
        </Suspense>
      </Route>
      <Route path="/admin/settings">
        <Suspense fallback={<LoadingFallback />}>
          <AdminCompanyProfile />
        </Suspense>
      </Route>
      <Route path="/course/:id">
        <Suspense fallback={<LoadingFallback />}>
          <CourseDetail />
        </Suspense>
      </Route>
      <Route path="/profile">
        <Suspense fallback={<LoadingFallback />}>
          <Profile />
        </Suspense>
      </Route>
      <Route path="/booking-success">
        <Suspense fallback={<LoadingFallback />}>
          <BookingSuccess />
        </Suspense>
      </Route>
      <Route path="/review/:bookingId">
        <Suspense fallback={<LoadingFallback />}>
          <Review />
        </Suspense>
      </Route>
      <Route path="/search">
        <Suspense fallback={<LoadingFallback />}>
          <TeeTimeSearch />
        </Suspense>
      </Route>
      <Route path="/checkout">
        <Suspense fallback={<LoadingFallback />}>
          <Checkout />
        </Suspense>
      </Route>
      <Route path="/my-bookings">
        <Suspense fallback={<LoadingFallback />}>
          <MyBookings />
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
          <BookingCartProvider>
            <AnalyticsProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </AnalyticsProvider>
          </BookingCartProvider>
        </FavoritesProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
