import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { User, LogOut, UserCircle, Shield, Menu, Mail, Search } from "lucide-react";
// Use CDN path for optimized logo delivery
const logoImage = "/generated_images/marbella_golf_times_logo.png";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { AuthDialog } from "@/components/AuthDialog";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Header() {
  const [location, setLocation] = useLocation();
  const { t } = useI18n();
  const { isAuthenticated, isAdmin } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch unanswered email count for admin users
  const { data: inboxData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/inbox/count"],
    enabled: isAdmin,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  const unansweredCount = inboxData?.count ?? 0;

  const navigateAndCloseMobile = (path: string) => {
    setMobileMenuOpen(false);
    setLocation(path);
  };

  const handleLogout = async () => {
    try {
      await apiRequest("/api/auth/logout", "POST");
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-2">
          {/* Logo - Clickable to home */}
          <Link href="/" data-testid="link-home-logo">
            <div className="flex items-center gap-2 hover-elevate px-2 sm:px-3 py-2 rounded-md cursor-pointer">
              <img 
                src={logoImage} 
                alt="Marbella Golf Times" 
                className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
                data-testid="img-logo"
              />
              <div className="flex flex-col">
                <span className="font-serif font-semibold text-base sm:text-lg leading-none">
                  {t('header.title')}
                </span>
                <span className="hidden sm:inline text-xs text-muted-foreground">{t('header.subtitle')}</span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            <Link href="/">
              <span
                className={`text-sm font-medium transition-colors hover:text-primary cursor-pointer ${
                  location === "/" ? "text-foreground" : "text-muted-foreground"
                }`}
                data-testid="link-find-courses"
              >
                Courses
              </span>
            </Link>
            <Link href="/search">
              <span
                className={`text-sm font-medium transition-colors hover:text-primary cursor-pointer flex items-center gap-1.5 ${
                  location === "/search" ? "text-foreground" : "text-muted-foreground"
                }`}
                data-testid="link-multi-search"
              >
                <Search className="h-4 w-4" />
                Multi-Search
              </span>
            </Link>
            {isAdmin && (
              <>
                <Link href="/admin">
                  <span
                    className={`text-sm font-medium transition-colors hover:text-primary cursor-pointer ${
                      location === "/admin" ? "text-foreground" : "text-muted-foreground"
                    }`}
                    data-testid="link-admin"
                  >
                    {t('header.admin')}
                  </span>
                </Link>
                <Link href="/admin?tab=inbox">
                  <div className="relative" data-testid="link-admin-inbox">
                    <Mail className={`h-5 w-5 transition-colors hover:text-primary cursor-pointer ${
                      location.includes("inbox") ? "text-foreground" : "text-muted-foreground"
                    }`} />
                    {unansweredCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 text-xs font-bold"
                        data-testid="badge-inbox-count"
                      >
                        {unansweredCount > 99 ? "99+" : unansweredCount}
                      </Badge>
                    )}
                  </div>
                </Link>
              </>
            )}
          </nav>

          {/* Desktop Right Actions */}
          <div className="hidden lg:flex items-center gap-2">
            <Link href="/#search">
              <Button variant="default" size="default" data-testid="button-find-tee-times-desktop">
                {t('search.searchButton')}
              </Button>
            </Link>
            <LanguageSwitcher />
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-user-menu">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer" data-testid="link-profile">
                      <UserCircle className="mr-2 h-4 w-4" />
                      {t('profile.title')}
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer" data-testid="link-admin-desktop">
                        <Shield className="mr-2 h-4 w-4" />
                        {t('header.admin')}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <button onClick={handleLogout} className="w-full cursor-pointer flex items-center" data-testid="button-logout">
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('header.logout')}
                    </button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  size="default" 
                  data-testid="button-login"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthDialogOpen(true);
                  }}
                >
                  {t('header.login')}
                </Button>
                <Button 
                  variant="outline" 
                  size="default" 
                  data-testid="button-signup"
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthDialogOpen(true);
                  }}
                >
                  {t('auth.signup')}
                </Button>
              </>
            )}
          </div>

          {/* Mobile Right Actions */}
          <div className="flex lg:hidden items-center gap-2">
            <LanguageSwitcher />
            
            {/* Mobile Menu - Always show for navigation */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="min-w-11 min-h-11" data-testid="button-mobile-menu" aria-label={t('common.menu')}>
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>{t('header.title')}</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 mt-8">
                  {isAuthenticated ? (
                    <>
                      <Button 
                        variant="default" 
                        size="lg" 
                        className="w-full min-h-12"
                        data-testid="button-search-mobile-auth"
                        onClick={() => navigateAndCloseMobile("/")}
                      >
                        {t('search.searchButton')}
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="lg" 
                        className="w-full min-h-12"
                        data-testid="button-multi-search-mobile"
                        onClick={() => navigateAndCloseMobile("/search")}
                      >
                        <Search className="mr-2 h-4 w-4" />
                        Multi-Search
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="lg" 
                        className="w-full min-h-12"
                        data-testid="button-profile-mobile"
                        onClick={() => navigateAndCloseMobile("/profile")}
                      >
                        <UserCircle className="mr-2 h-4 w-4" />
                        {t('profile.title')}
                      </Button>
                      {isAdmin && (
                        <>
                          <Button 
                            variant="secondary" 
                            size="lg" 
                            className="w-full min-h-12"
                            data-testid="button-admin-mobile-nav"
                            onClick={() => navigateAndCloseMobile("/admin")}
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            {t('header.admin')}
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="lg" 
                            className="w-full min-h-12 relative"
                            data-testid="button-inbox-mobile-nav"
                            onClick={() => navigateAndCloseMobile("/admin?tab=inbox")}
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            {t('inbox.title')}
                            {unansweredCount > 0 && (
                              <Badge 
                                variant="destructive" 
                                className="ml-2 h-5 min-w-5 flex items-center justify-center p-0 text-xs font-bold"
                                data-testid="badge-inbox-count-mobile"
                              >
                                {unansweredCount > 99 ? "99+" : unansweredCount}
                              </Badge>
                            )}
                          </Button>
                        </>
                      )}
                      <Button 
                        variant="outline" 
                        size="lg" 
                        className="w-full min-h-12"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleLogout();
                        }}
                        data-testid="button-logout-mobile-nav"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        {t('header.logout')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        variant="default" 
                        size="lg" 
                        className="w-full min-h-12"
                        data-testid="button-login-mobile"
                        onClick={() => {
                          setAuthMode("login");
                          setAuthDialogOpen(true);
                          setMobileMenuOpen(false);
                        }}
                      >
                        {t('header.login')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="lg" 
                        className="w-full min-h-12"
                        data-testid="button-signup-mobile"
                        onClick={() => {
                          setAuthMode("signup");
                          setAuthDialogOpen(true);
                          setMobileMenuOpen(false);
                        }}
                      >
                        {t('auth.signup')}
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="lg" 
                        className="w-full min-h-12"
                        data-testid="button-search-mobile"
                        onClick={() => navigateAndCloseMobile("/")}
                      >
                        {t('search.searchButton')}
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="lg" 
                        className="w-full min-h-12"
                        data-testid="button-multi-search-mobile-guest"
                        onClick={() => navigateAndCloseMobile("/search")}
                      >
                        <Search className="mr-2 h-4 w-4" />
                        Multi-Search
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
            
            {/* Keep user icon for quick profile access when authenticated */}
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="min-w-11 min-h-11" data-testid="button-user-menu-mobile" aria-label={t('profile.title')}>
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer" data-testid="link-profile-mobile">
                      <UserCircle className="mr-2 h-4 w-4" />
                      {t('profile.title')}
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer" data-testid="link-admin-mobile">
                        <Shield className="mr-2 h-4 w-4" />
                        {t('header.admin')}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <button onClick={handleLogout} className="w-full cursor-pointer flex items-center" data-testid="button-logout-mobile">
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('header.logout')}
                    </button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
      <AuthDialog 
        open={authDialogOpen} 
        onOpenChange={setAuthDialogOpen}
        initialMode={authMode}
      />
    </header>
  );
}
