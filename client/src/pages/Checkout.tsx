import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBookingCart } from "@/contexts/BookingCartContext";
import { useLocation } from "wouter";
import { ArrowLeft, Clock, Users, Euro, CreditCard, ShoppingCart, Calendar, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Checkout() {
  const { items, getTotalPrice, clearCart } = useBookingCart();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const createCheckoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/checkout/create-session", {
        items: items.map(item => ({
          courseId: item.courseId,
          courseName: item.courseName,
          date: item.date,
          time: item.time,
          players: item.players,
          packageId: item.package.id,
          packageName: item.package.name,
          addOns: item.addOns || [],
          totalPrice: item.totalPrice,
          providerType: item.providerType,
        })),
        customerInfo,
        totalAmount: getTotalPrice(),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error) => {
      toast({
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const formatTime = (timeStr: string) => {
    try {
      return format(new Date(timeStr), 'HH:mm');
    } catch {
      return timeStr.slice(11, 16);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEEE, MMMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle>Your cart is empty</CardTitle>
            <CardDescription>
              Add some tee times to your cart before checkout
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => navigate("/search")} data-testid="button-browse-courses">
              Browse Courses
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const handleCheckout = () => {
    if (!customerInfo.name || !customerInfo.email) {
      toast({
        title: "Missing information",
        description: "Please fill in your name and email",
        variant: "destructive",
      });
      return;
    }
    createCheckoutMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate("/search")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Search
        </Button>

        <h1 className="text-2xl font-bold mb-6">Checkout</h1>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Tee Times</CardTitle>
                <CardDescription>
                  {items.length} booking{items.length !== 1 ? 's' : ''} selected
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4"
                    data-testid={`checkout-item-${item.id}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium">{item.courseName}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(item.date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm mt-1">
                          <span className="flex items-center gap-1 text-primary font-bold">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(item.time)}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {item.players} players
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold flex items-center gap-0.5">
                          <Euro className="h-4 w-4" />
                          {item.totalPrice}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">{item.package.name}</Badge>
                      {item.addOns && item.addOns.map((addOn) => (
                        <Badge key={addOn.id} variant="secondary">
                          {addOn.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
                <CardDescription>
                  We'll send your booking confirmation here
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Smith"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+34 612 345 678"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                    data-testid="input-phone"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground line-clamp-1 flex-1 mr-2">
                      {item.courseName}
                    </span>
                    <span className="font-medium">€{item.totalPrice}</span>
                  </div>
                ))}
                
                <Separator />
                
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total</span>
                  <span className="text-2xl font-bold text-primary" data-testid="checkout-total">
                    €{getTotalPrice()}
                  </span>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCheckout}
                  disabled={createCheckoutMutation.isPending}
                  data-testid="button-pay"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {createCheckoutMutation.isPending ? "Processing..." : "Pay Now"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
