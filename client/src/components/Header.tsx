import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { MapPin, User } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const [location] = useLocation();
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-2 cursor-pointer hover-elevate px-3 py-2 rounded-md">
            <Link href="/" data-testid="link-home">
              <MapPin className="h-6 w-6 text-primary" />
            </Link>
            <Link href="/" className="flex flex-col">
              <span className="font-serif font-semibold text-lg leading-none">
                {t('header.title')}
              </span>
              <span className="text-xs text-muted-foreground">{t('header.subtitle')}</span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/">
              <span
                className={`text-sm font-medium transition-colors hover:text-primary cursor-pointer ${
                  location === "/" ? "text-foreground" : "text-muted-foreground"
                }`}
                data-testid="link-find-courses"
              >
                {t('search.searchButton')}
              </span>
            </Link>
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
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {isAuthenticated && (
              <Link href="/profile">
                <Button variant="ghost" size="icon" data-testid="link-profile">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
            )}
            <Link href="/">
              <Button size="default" data-testid="button-search-tee-times">
                {t('search.searchButton')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
