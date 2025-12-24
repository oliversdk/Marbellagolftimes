import { Link, useLocation } from "wouter";
import { Home, Search, Calendar, User, Heart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";

interface MobileLayoutProps {
  children: React.ReactNode;
  activeTab?: "home" | "search" | "bookings" | "favorites" | "profile";
}

export function MobileLayout({ children, activeTab = "home" }: MobileLayoutProps) {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const { favorites } = useFavorites();
  
  const navItems = [
    { id: "home", icon: Home, label: "Hjem", href: "/" },
    { id: "search", icon: Search, label: "Søg", href: "/?search=true" },
    { id: "favorites", icon: Heart, label: "Favoritter", href: "/?favorites=true", badge: favorites.size },
    { id: "bookings", icon: Calendar, label: "Bookinger", href: "/my-bookings" },
    { id: "profile", icon: User, label: "Profil", href: isAuthenticated ? "/profile" : "/auth" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>
      
      <nav 
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-border z-50 safe-area-bottom"
        data-testid="mobile-bottom-nav"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id || 
              (item.id === "home" && location === "/" && !activeTab);
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.id} 
                href={item.href}
                className="flex flex-col items-center justify-center flex-1 h-full relative"
                data-testid={`nav-${item.id}`}
              >
                <div className={`relative p-2 rounded-xl transition-all ${
                  isActive 
                    ? "bg-primary/10" 
                    : ""
                }`}>
                  <Icon 
                    className={`h-5 w-5 transition-colors ${
                      isActive 
                        ? "text-primary" 
                        : "text-muted-foreground"
                    }`} 
                  />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] mt-0.5 font-medium ${
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground"
                }`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
