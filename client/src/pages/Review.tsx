import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, CheckCircle2, AlertCircle, MapPin, Calendar, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface BookingReviewData {
  booking: {
    id: string;
    customerName: string;
    teeTime: string;
    players: number;
    userId: string | null;
  };
  course: {
    id: string;
    name: string;
    city: string;
    imageUrl: string | null;
  };
}

interface RatingCriteria {
  key: string;
  label: string;
  value: number;
}

function StarRating({ 
  value, 
  onChange, 
  disabled = false 
}: { 
  value: number; 
  onChange: (val: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => !disabled && setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`star-${star}`}
        >
          <Star
            className={`w-7 h-7 transition-colors ${
              star <= (hovered || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function Review() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [reviewText, setReviewText] = useState("");
  
  const [criteria, setCriteria] = useState<RatingCriteria[]>([
    { key: "courseCondition", label: "Course Condition", value: 0 },
    { key: "serviceQuality", label: "Service Quality", value: 0 },
    { key: "valueForMoney", label: "Value for Money", value: 0 },
    { key: "facilities", label: "Facilities", value: 0 },
    { key: "overallExperience", label: "Overall Experience", value: 0 },
  ]);

  const { data, isLoading, error } = useQuery<BookingReviewData>({
    queryKey: ["/api/reviews/booking", bookingId],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/booking/${bookingId}`);
      if (!res.ok) throw new Error("Failed to fetch booking");
      return res.json();
    },
    enabled: !!bookingId,
  });

  const submitMutation = useMutation({
    mutationFn: async (reviewData: { 
      bookingId: string; 
      courseId: string; 
      rating: number; 
      title: string;
      review: string;
    }) => {
      return apiRequest("/api/reviews", {
        method: "POST",
        body: JSON.stringify(reviewData),
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Thank you!",
        description: "Your review has been submitted successfully.",
      });
    },
    onError: (err: any) => {
      const errorMessage = err?.message || "Failed to submit review";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateCriterion = (key: string, value: number) => {
    setCriteria(prev => 
      prev.map(c => c.key === key ? { ...c, value } : c)
    );
  };

  const calculateAverageRating = (): number => {
    const validRatings = criteria.filter(c => c.value > 0);
    if (validRatings.length === 0) return 0;
    const sum = validRatings.reduce((acc, c) => acc + c.value, 0);
    return sum / validRatings.length;
  };

  const allCriteriaRated = criteria.every(c => c.value > 0);

  const handleSubmit = () => {
    if (!data || !allCriteriaRated) return;
    
    const averageRating = calculateAverageRating();
    const criteriaDetails = criteria
      .map(c => `${c.label}: ${c.value}/5`)
      .join(" | ");
    
    submitMutation.mutate({
      bookingId: data.booking.id,
      courseId: data.course.id,
      rating: Math.round(averageRating),
      title: `Review for ${data.course.name}`,
      review: reviewText ? `${reviewText}\n\n[Ratings: ${criteriaDetails}]` : `[Ratings: ${criteriaDetails}]`,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent className="space-y-6">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-48" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2" data-testid="error-title">
              Booking Not Found
            </h2>
            <p className="text-muted-foreground" data-testid="error-message">
              This review link may be invalid or expired. Please check your email for the correct link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2" data-testid="success-title">
              Thank You!
            </h2>
            <p className="text-muted-foreground mb-4" data-testid="success-message">
              Your review for {data.course.name} has been submitted successfully.
            </p>
            <p className="text-sm text-muted-foreground">
              Your feedback helps other golfers make informed decisions.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const teeTimeDate = new Date(data.booking.teeTime);
  const averageRating = calculateAverageRating();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl" data-testid="review-title">
              Rate Your Experience
            </CardTitle>
            <CardDescription data-testid="review-description">
              How was your round at {data.course.name}?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              {data.course.imageUrl && (
                <img 
                  src={data.course.imageUrl} 
                  alt={data.course.name}
                  className="w-full h-32 object-cover rounded-lg mb-3"
                />
              )}
              <h3 className="font-semibold text-lg" data-testid="course-name">
                {data.course.name}
              </h3>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {data.course.city}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(teeTimeDate, "PPP 'at' p")}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {data.booking.players} {data.booking.players === 1 ? "player" : "players"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rate Each Aspect</CardTitle>
            <CardDescription>
              Click the stars to rate each category from 1 to 5
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {criteria.map((criterion) => (
              <div key={criterion.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="font-medium text-sm" data-testid={`label-${criterion.key}`}>
                  {criterion.label}
                </label>
                <StarRating
                  value={criterion.value}
                  onChange={(val) => updateCriterion(criterion.key, val)}
                  disabled={submitMutation.isPending}
                />
              </div>
            ))}

            {averageRating > 0 && (
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Average Rating</span>
                  <div className="flex items-center gap-2">
                    <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                    <span className="text-xl font-bold" data-testid="average-rating">
                      {averageRating.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional Comments</CardTitle>
            <CardDescription>
              Share more details about your experience (optional)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Tell us about your round... What did you enjoy most? Any suggestions for improvement?"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={4}
              disabled={submitMutation.isPending}
              data-testid="review-text"
              className="resize-none"
            />
          </CardContent>
        </Card>

        <Button
          onClick={handleSubmit}
          disabled={!allCriteriaRated || submitMutation.isPending}
          className="w-full"
          size="lg"
          data-testid="submit-review"
        >
          {submitMutation.isPending ? "Submitting..." : "Submit Review"}
        </Button>

        {!allCriteriaRated && (
          <p className="text-center text-sm text-muted-foreground">
            Please rate all categories to submit your review
          </p>
        )}
      </div>
    </div>
  );
}
