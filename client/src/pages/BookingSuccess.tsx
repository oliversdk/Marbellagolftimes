import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Calendar, MapPin, Users, Clock, Download, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface SessionData {
  id: string;
  status: string;
  payment_status: string;
  customer_email: string | null;
  amount_total: number | null;
  currency: string | null;
  metadata: {
    courseId?: string;
    courseName?: string;
    teeTime?: string;
    players?: string;
    customerName?: string;
  } | null;
}

export default function BookingSuccess() {
  const [, setLocation] = useLocation();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session_id");

    if (sessionId) {
      fetch(`/api/checkout-session/${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          setSessionData(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching session:", err);
          setError("Failed to load booking details");
          setLoading(false);
        });
    } else {
      setError("No session ID found");
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Something went wrong</CardTitle>
            <CardDescription>{error || "Unable to load booking confirmation"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const metadata = sessionData.metadata || {};
  const teeTimeDate = metadata.teeTime ? new Date(metadata.teeTime) : null;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Booking Confirmed!</h1>
          <p className="text-muted-foreground">
            Your tee time has been successfully booked
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-xl">{metadata.courseName || "Golf Course"}</CardTitle>
              <Badge variant="default" className="bg-green-600">
                {sessionData.payment_status === "paid" ? "Paid" : sessionData.payment_status}
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

            {metadata.players && (
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span>{metadata.players} Player{parseInt(metadata.players) > 1 ? "s" : ""}</span>
              </div>
            )}

            {metadata.courseId && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => setLocation(`/course/${metadata.courseId}`)}
                >
                  View Course Details
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}

            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="text-2xl font-bold text-primary">
                  €{((sessionData.amount_total || 0) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Confirmation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Confirmation Number</span>
              <span className="font-mono">{sessionData.id.slice(-8).toUpperCase()}</span>
            </div>
            {sessionData.customer_email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{sessionData.customer_email}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              A confirmation email has been sent to your email address with all the booking details.
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
