import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { StarRating } from "@/components/StarRating";
import { Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Testimonial } from "@shared/schema";

export function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const { data: testimonials, isLoading } = useQuery<Testimonial[]>({
    queryKey: ["/api/testimonials"],
  });

  const itemsPerPage = 3;
  const totalPages = testimonials ? Math.ceil(testimonials.length / itemsPerPage) : 0;

  // Shared helper to normalize index and prevent NaN
  const normalizeIndex = (totalPages: number, candidate: number): number => {
    if (totalPages === 0 || isNaN(candidate) || candidate < 0) {
      return 0;
    }
    return candidate % totalPages;
  };

  // Reset currentIndex when testimonials load or totalPages changes
  useEffect(() => {
    setCurrentIndex((prev) => normalizeIndex(totalPages, prev));
  }, [totalPages]);

  // Auto-rotation effect
  useEffect(() => {
    // Guard: only rotate if we have testimonials and multiple pages
    if (!isAutoPlaying || !testimonials || testimonials.length === 0 || totalPages <= 1) {
      return; // No interval needed
    }

    const intervalId = setInterval(() => {
      setCurrentIndex((prev) => normalizeIndex(totalPages, prev + 1));
    }, 5000); // Rotate every 5 seconds

    return () => clearInterval(intervalId);
  }, [isAutoPlaying, testimonials, totalPages, normalizeIndex]);

  const handlePrev = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => normalizeIndex(totalPages, prev - 1 + totalPages));
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => normalizeIndex(totalPages, prev + 1));
  };

  const handleIndicatorClick = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentIndex(normalizeIndex(totalPages, index));
  };

  if (isLoading) {
    return (
      <div className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl font-bold text-center mb-12">
            What Our Golfers Say
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-muted rounded mb-4"></div>
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!testimonials || testimonials.length === 0) {
    return null;
  }

  // Use normalized index for rendering
  const safeIndex = normalizeIndex(totalPages, currentIndex);
  
  const visibleTestimonials = testimonials.slice(
    safeIndex * itemsPerPage,
    (safeIndex + 1) * itemsPerPage
  );

  return (
    <div className="py-16 bg-muted/30" data-testid="section-testimonials">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-serif text-3xl font-bold text-center mb-12" data-testid="heading-testimonials">
          What Our Golfers Say
        </h2>

        <div className="relative">
          {/* Navigation Buttons - Hidden on mobile */}
          {totalPages > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 hidden lg:flex"
                onClick={handlePrev}
                data-testid="button-carousel-prev"
                aria-label="Previous testimonials"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 hidden lg:flex"
                onClick={handleNext}
                data-testid="button-carousel-next"
                aria-label="Next testimonials"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Testimonials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="carousel-testimonials">
            {visibleTestimonials.map((testimonial) => (
              <Card
                key={testimonial.id}
                className="hover-elevate"
                data-testid={`card-testimonial-${testimonial.id}`}
              >
                <CardContent className="p-6 flex flex-col h-full">
                  <Quote className="h-10 w-10 text-primary/20 mb-4" />
                  
                  <div className="mb-4">
                    <StarRating 
                      rating={testimonial.rating} 
                      size="sm" 
                      data-testid={`rating-testimonial-${testimonial.id}`}
                    />
                  </div>

                  <p className="text-muted-foreground mb-6 flex-1" data-testid={`text-testimonial-content-${testimonial.id}`}>
                    "{testimonial.content}"
                  </p>

                  <div className="mt-auto">
                    <p className="font-semibold" data-testid={`text-testimonial-author-${testimonial.id}`}>
                      {testimonial.customerName}
                    </p>
                    {testimonial.location && (
                      <p className="text-sm text-muted-foreground" data-testid={`text-testimonial-location-${testimonial.id}`}>
                        {testimonial.location}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Carousel Indicators */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8" data-testid="carousel-indicators">
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index}
                onClick={() => handleIndicatorClick(index)}
                className={`h-2 w-2 rounded-full transition-all hover-elevate ${
                  index === currentIndex
                    ? "bg-primary w-8"
                    : "bg-muted-foreground/30"
                }`}
                data-testid={`indicator-${index}`}
                aria-label={`Go to testimonial group ${index + 1}`}
                aria-current={index === currentIndex}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
