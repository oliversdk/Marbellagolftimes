import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, Trash2, Clock, Users, Car, Utensils, Euro, CreditCard, X } from "lucide-react";
import { useBookingCart, CartItem } from "@/contexts/BookingCartContext";
import { useLocation } from "wouter";

interface CartSidebarProps {
  className?: string;
}

export function CartSidebar({ className }: CartSidebarProps) {
  const { items, removeItem, getTotalPrice, getItemCount, clearCart } = useBookingCart();
  const [, navigate] = useLocation();

  const formatTime = (timeStr: string) => {
    try {
      return format(new Date(timeStr), 'HH:mm');
    } catch {
      return timeStr.slice(11, 16);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEE, MMM d');
    } catch {
      return dateStr;
    }
  };

  const groupedByDate = items.reduce((acc, item) => {
    const dateKey = item.date;
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(item);
    return acc;
  }, {} as Record<string, CartItem[]>);

  const sortedDates = Object.keys(groupedByDate).sort();

  const handleCheckout = () => {
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <Card className={className} data-testid="cart-sidebar">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5" />
            Your Booking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <ShoppingCart className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No tee times selected yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click on a tee time to add it to your booking
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="cart-sidebar">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5" />
            Your Booking
          </CardTitle>
          <Badge variant="secondary" data-testid="cart-count">
            {getItemCount()} tee time{getItemCount() !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="max-h-[400px]">
          <div className="px-6 space-y-4">
            {sortedDates.map((date) => (
              <div key={date}>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {formatDate(date)}
                </h4>
                
                <div className="space-y-2">
                  {groupedByDate[date].map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border p-3 relative group"
                      data-testid={`cart-item-${item.id}`}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeItem(item.id)}
                        data-testid={`button-remove-${item.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-medium line-clamp-1">
                            {item.courseName}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {formatTime(item.time)}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Users className="h-3 w-3" />
                              {item.players}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium flex items-center gap-0.5">
                            <Euro className="h-3 w-3" />
                            {item.totalPrice}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">
                          {item.package.name}
                        </Badge>
                        {item.package.includesBuggy && (
                          <Badge variant="secondary" className="text-xs">
                            <Car className="h-2.5 w-2.5 mr-0.5" />
                            Buggy
                          </Badge>
                        )}
                        {item.package.includesLunch && (
                          <Badge variant="secondary" className="text-xs">
                            <Utensils className="h-2.5 w-2.5 mr-0.5" />
                            Lunch
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      
      <CardFooter className="flex-col gap-3 pt-4">
        <Separator />
        
        <div className="flex items-center justify-between w-full">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-xl font-bold flex items-center gap-1" data-testid="cart-total">
            <Euro className="h-4 w-4" />
            {getTotalPrice()}
          </span>
        </div>
        
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={clearCart}
            className="flex-shrink-0"
            data-testid="button-clear-cart"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            className="flex-1"
            onClick={handleCheckout}
            data-testid="button-checkout"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Checkout
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
