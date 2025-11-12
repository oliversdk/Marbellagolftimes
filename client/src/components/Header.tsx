import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

export function Header() {
  const [location] = useLocation();

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
                Costa del Sol
              </span>
              <span className="text-xs text-muted-foreground">Tee Times</span>
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
                Find Courses
              </span>
            </Link>
            <Link href="/admin">
              <span
                className={`text-sm font-medium transition-colors hover:text-primary cursor-pointer ${
                  location === "/admin" ? "text-foreground" : "text-muted-foreground"
                }`}
                data-testid="link-admin"
              >
                Admin
              </span>
            </Link>
          </nav>

          <Link href="/">
            <Button size="default" data-testid="button-search-tee-times">
              Search Tee Times
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
