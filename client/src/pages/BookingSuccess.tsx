import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Calendar, MapPin, Users, Clock, Download, ExternalLink, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface BookingData {
  id: string;
  courseId: string;
  teeTime: string;
  players: number;
  customerName: string;
  customerEmail: string;
  status: string;
  paymentStatus: string;
  totalAmountCents: number | null;
  addOnsJson: string | null;
}

interface ConfirmResponse {
  booking: BookingData;
  alreadyExists: boolean;
}

export default function BookingSuccess() {
  const [, setLocation] = useLocation();
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [courseName, setCourseName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const confirmPayment = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session_id");

      if (!sessionId) {
        setError("No session ID found in URL");
        setLoading(false);
        return;
      }

      try {
        // Confirm the payment and create/retrieve the booking from database
        const confirmRes = await fetch("/api/confirm-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (!confirmRes.ok) {
          const errorData = await confirmRes.json();
          throw new Error(errorData.error || "Failed to confirm payment");
        }

        const confirmData: ConfirmResponse = await confirmRes.json();
        
        // Ensure we have a valid booking from the database
        if (!confirmData.booking || !confirmData.booking.id) {
          throw new Error("Booking could not be created");
        }
        
        setBooking(confirmData.booking);

        // Fetch course name for display
        if (confirmData.booking.courseId) {
          try {
            const courseRes = await fetch(`/api/courses/${confirmData.booking.courseId}`);
            if (courseRes.ok) {
              const courseData = await courseRes.json();
              setCourseName(courseData.name);
            }
          } catch {
            // Course name is not critical for success display
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Error confirming payment:", err);
        
        // Retry a few times in case of timing issues with Stripe webhook
        if (retryCount < 3) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 2000);
          return;
        }
        
        setError(err instanceof Error ? err.message : "Failed to confirm your booking. Please contact support.");
        setLoading(false);
      }
    };

    confirmPayment();
  }, [retryCount]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">
            {retryCount > 0 ? `Confirming booking (attempt ${retryCount + 1})...` : "Confirming your booking..."}
          </p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Booking Confirmation Issue</CardTitle>
            </div>
            <CardDescription>{error || "Unable to confirm your booking"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If you completed payment, your booking may still be processing. 
              Please check your email for confirmation or contact us for assistance.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={() => setLocation("/profile")} className="flex-1">
                Check My Bookings
              </Button>
              <Button onClick={() => setLocation("/")} className="flex-1">
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const teeTimeDate = booking.teeTime ? new Date(booking.teeTime) : null;
  const totalAmount = booking.totalAmountCents ? booking.totalAmountCents / 100 : 0;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Booking Confirmed!</h1>
          <p className="text-muted-foreground">
            Your tee time has been successfully booked and paid
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-xl">{courseName || "Golf Course"}</CardTitle>
              <Badge variant="default" className="bg-green-600">
                {booking.paymentStatus === "paid" ? "Paid" : booking.paymentStatus}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {teeTimeDate && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{format(teeTimeDate, "EEEE, MMMM d, yyyy")}</p>
                  <p className="text-sm text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {format(teeTimeDate, "HH:mm")}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span>{booking.players} Player{booking.players > 1 ? "s" : ""}</span>
            </div>

            {booking.courseId && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => setLocation(`/course/${booking.courseId}`)}
                >
                  View Course Details
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}

            {totalAmount > 0 && (
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Paid</span>
                  <span className="text-2xl font-bold text-primary">
                    €{totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Confirmation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Booking Reference</span>
              <span className="font-mono">{booking.id.slice(-8).toUpperCase()}</span>
            </div>
            {booking.customerName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span>{booking.customerName}</span>
              </div>
            )}
            {booking.customerEmail && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{booking.customerEmail}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              A confirmation email will be sent to your email address with all booking details.
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-3 flex-wrap">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setLocation("/profile")}
            data-testid="button-view-bookings"
          >
            <Download className="h-4 w-4 mr-2" />
            View My Bookings
          </Button>
          <Button
            className="flex-1"
            onClick={() => setLocation("/")}
            data-testid="button-book-another"
          >
            Book Another Tee Time
          </Button>
        </div>
      </div>
    </div>
  );
}
