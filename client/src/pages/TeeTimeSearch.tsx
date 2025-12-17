import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SEO } from "@/components/SEO";
import { GolfLoader } from "@/components/GolfLoader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format, addDays, differenceInDays } from "date-fns";
import { Calendar as CalendarIcon, Search, MapPin, Clock, Users, ArrowLeft, ChevronDown, ChevronUp, Euro, Check, ShoppingCart } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { PackageSelectionDialog } from "@/components/PackageSelectionDialog";
import { CartSidebar } from "@/components/CartSidebar";
import { useBookingCart } from "@/contexts/BookingCartContext";

interface RealTimeCourse {
  id: string;
  name: string;
  zestFacilityId: number | null;
  bookingUrl: string;
  imageUrl: string | null;
  city: string;
  providerType: 'zest' | 'golfmanager';
  hasGolfmanagerV1?: boolean;
  hasGolfmanagerV3?: boolean;
}

interface TeeTime {
  id: string | number;
  time: string;
  price: number;
  currency: string;
  players: number;
  holes: number;
  source: string;
  packageName?: string;
  packages?: any[];
  addOns?: any[];
}

interface ContractSettings {
  twilightStartTime: string | null;
  earlyBirdEndTime: string | null;
  currentSeason: string | null;
}

interface CourseSearchResult {
  courseId: string;
  courseName: string;
  providerType: string;
  contractSettings?: ContractSettings;
  dates: Array<{
    date: string;
    teeTimes: TeeTime[];
    error?: string;
  }>;
}

interface MultiSearchResponse {
  success: boolean;
  courses: CourseSearchResult[];
  summary: {
    totalCourses: number;
    totalDates: number;
    totalTeeTimes: number;
  };
}

export default function TeeTimeSearch() {
  const [, navigate] = useLocation();
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(),
    to: addDays(new Date(), 3),
  });
  const [players, setPlayers] = useState<string>("4");
  const [holes, setHoles] = useState<string>("18");
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [selectedTeeTime, setSelectedTeeTime] = useState<TeeTime | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<{ courseId: string; courseName: string; providerType: string; city?: string; contractSettings?: ContractSettings } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  
  const { hasItem, getItemCount } = useBookingCart();

  // Use the new multi-provider endpoint that returns Zest AND Golfmanager courses
  const { data: courses, isLoading: coursesLoading } = useQuery<{ success: boolean; courses: RealTimeCourse[] }>({
    queryKey: ['/api/courses/realtime-providers'],
  });

  const searchMutation = useMutation({
    mutationFn: async (): Promise<MultiSearchResponse> => {
      if (selectedCourses.length === 0) {
        return {
          success: true,
          courses: [],
          summary: {
            totalCourses: 0,
            totalDates: 0,
            totalTeeTimes: 0,
          },
        };
      }

      // Use the new multi-provider search endpoint
      const response = await apiRequest('/api/teetimes/multi-search', 'POST', {
        courseIds: selectedCourses,
        fromDate: dateRange.from?.toISOString(),
        toDate: dateRange.to?.toISOString(),
        players: parseInt(players),
        holes: parseInt(holes),
      });
      return await response.json() as MultiSearchResponse;
    },
  });

  const handleCourseToggle = (courseId: string) => {
    setSelectedCourses(prev =>
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleSearch = () => {
    if (selectedCourses.length === 0 || !dateRange.from || !dateRange.to) return;
    setExpandedCourses(new Set()); // Reset expanded state
    searchMutation.mutate(undefined, {
      onSuccess: (data) => {
        // Auto-expand first course with tee times (with defensive null check)
        if (data?.courses && Array.isArray(data.courses)) {
          const firstCourseWithTeeTimes = data.courses.find(
            c => c.dates?.some(d => d.teeTimes?.length > 0)
          );
          if (firstCourseWithTeeTimes) {
            setExpandedCourses(new Set([firstCourseWithTeeTimes.courseId]));
          }
        }
      }
    });
  };

  const toggleCourseExpand = (courseId: string) => {
    setExpandedCourses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseId)) {
        newSet.delete(courseId);
      } else {
        newSet.add(courseId);
      }
      return newSet;
    });
  };

  const getCourseInfo = (courseId: string) => {
    return courses?.courses.find(c => c.id === courseId);
  };

  const formatPrice = (price: number, currency: string = 'EUR') => {
    return `€${price.toFixed(0)}`;
  };

  const getProviderBadge = (providerType: string) => {
    switch (providerType) {
      case 'zest':
        return <Badge variant="secondary" className="text-xs">Zest</Badge>;
      case 'golfmanager':
        return <Badge variant="outline" className="text-xs border-green-500 text-green-700">GM</Badge>;
      default:
        return null;
    }
  };

  const dateDiff = dateRange.from && dateRange.to
    ? differenceInDays(dateRange.to, dateRange.from) + 1
    : 0;

  return (
    <>
      <SEO
        title="Multi-Course Tee Time Search - Marbella Golf Times"
        description="Search and compare tee times across multiple golf courses and dates on Costa del Sol"
      />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-4 md:p-6 max-w-7xl">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => navigate('/')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Search Tee Times
                  </CardTitle>
                  <CardDescription>
                    Select courses, dates and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date Range</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateRange.from && "text-muted-foreground"
                          )}
                          data-testid="button-date-range"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                              </>
                            ) : (
                              format(dateRange.from, "PPP")
                            )
                          ) : (
                            "Pick dates"
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={dateRange}
                          onSelect={(range) => {
                            if (range) {
                              const from = range.from;
                              let to = range.to;
                              if (from && to && differenceInDays(to, from) > 6) {
                                to = addDays(from, 6);
                              }
                              setDateRange({ from, to });
                            }
                          }}
                          disabled={(date) => date < new Date() || date > addDays(new Date(), 90)}
                          fromDate={new Date()}
                          toDate={addDays(new Date(), 90)}
                          numberOfMonths={2}
                        />
                        <div className="p-3 border-t text-xs text-muted-foreground">
                          Max 7 days range
                        </div>
                      </PopoverContent>
                    </Popover>
                    {dateDiff > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {dateDiff} day{dateDiff !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Players</label>
                      <Select value={players} onValueChange={setPlayers}>
                        <SelectTrigger data-testid="select-players">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Player</SelectItem>
                          <SelectItem value="2">2 Players</SelectItem>
                          <SelectItem value="3">3 Players</SelectItem>
                          <SelectItem value="4">4 Players</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Holes</label>
                      <Select value={holes} onValueChange={setHoles}>
                        <SelectTrigger data-testid="select-holes">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="9">9 Holes</SelectItem>
                          <SelectItem value="18">18 Holes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Select Courses ({selectedCourses.length} selected)
                    </label>
                    {coursesLoading ? (
                      <div className="py-4">
                        <GolfLoader size="sm" text="Loading courses..." />
                      </div>
                    ) : courses?.courses && courses.courses.length > 0 ? (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                        {courses.courses.map(course => (
                          <label
                            key={course.id}
                            className="flex items-start gap-3 p-2 rounded-md hover-elevate cursor-pointer"
                            data-testid={`checkbox-course-${course.id}`}
                          >
                            <Checkbox
                              checked={selectedCourses.includes(course.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedCourses(prev => [...prev, course.id]);
                                } else {
                                  setSelectedCourses(prev => prev.filter(id => id !== course.id));
                                }
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium leading-tight">{course.name}</p>
                                <Badge 
                                  variant="outline" 
                                  className={`text-[10px] px-1.5 py-0 ${
                                    course.providerType === 'golfmanager' 
                                      ? 'border-green-500 text-green-700' 
                                      : ''
                                  }`}
                                >
                                  {course.providerType === 'zest' ? 'Zest' : 'GM'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3" />
                                {course.city}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No courses with real-time availability found
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    Search compares availability across selected courses
                  </p>

                  <Button
                    className="w-full"
                    onClick={handleSearch}
                    disabled={selectedCourses.length === 0 || !dateRange.from || !dateRange.to || searchMutation.isPending}
                    data-testid="button-search"
                  >
                    {searchMutation.isPending ? (
                      <>
                        <GolfLoader size="sm" />
                        <span className="ml-2">Searching...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Search {selectedCourses.length} Course{selectedCourses.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 xl:col-span-2">
              {searchMutation.data ? (
                !searchMutation.data.courses?.length || searchMutation.data.summary?.totalTeeTimes === 0 ? (
                  <Card>
                    <CardContent className="py-12">
                      <div className="text-center">
                        <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">No Tee Times Found</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                          No tee times available for the selected courses and dates. Try expanding your date range or selecting different courses.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle>Search Results</CardTitle>
                      <CardDescription>
                        Found {searchMutation.data.summary?.totalTeeTimes || 0} tee times across{' '}
                        {searchMutation.data.summary?.totalCourses || 0} courses and{' '}
                        {searchMutation.data.summary?.totalDates || 0} dates
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  {(searchMutation.data.courses || []).map(course => {
                    const courseInfo = getCourseInfo(course.courseId);
                    const isExpanded = expandedCourses.has(course.courseId);
                    const totalTeeTimes = (course.dates || []).reduce((sum, d) => sum + (d.teeTimes?.length || 0), 0);

                    return (
                      <Card key={course.courseId}>
                        <CardHeader
                          className="cursor-pointer"
                          onClick={() => toggleCourseExpand(course.courseId)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {courseInfo?.imageUrl && (
                                <img
                                  src={courseInfo.imageUrl}
                                  alt={course.courseName}
                                  className="w-12 h-12 rounded-md object-cover"
                                />
                              )}
                              <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                  {course.courseName}
                                  {getProviderBadge(course.providerType)}
                                </CardTitle>
                                <CardDescription className="flex items-center gap-2">
                                  <Badge variant="secondary">{totalTeeTimes} tee times</Badge>
                                  {courseInfo?.city && (
                                    <span className="text-xs flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {courseInfo.city}
                                    </span>
                                  )}
                                </CardDescription>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </div>
                        </CardHeader>

                        {isExpanded && (
                          <CardContent className="pt-0">
                            {(course.dates || []).map(dateData => (
                              <div key={dateData.date} className="mb-4 last:mb-0">
                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                  <CalendarIcon className="h-4 w-4" />
                                  {format(new Date(dateData.date), 'EEEE, MMMM d')}
                                  <Badge variant="outline" className="ml-auto">
                                    {dateData.teeTimes?.length || 0} slots
                                  </Badge>
                                </h4>

                                {dateData.error ? (
                                  <p className="text-sm text-destructive">{dateData.error}</p>
                                ) : (dateData.teeTimes?.length || 0) > 0 ? (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {(dateData.teeTimes || []).map((teeTime, idx) => (
                                      <Button
                                        key={`${teeTime.id}-${idx}`}
                                        variant={hasItem(course.courseId, teeTime.time) ? "default" : "outline"}
                                        className={cn(
                                          "flex flex-col items-start p-3 h-auto",
                                          hasItem(course.courseId, teeTime.time) && "ring-2 ring-primary"
                                        )}
                                        onClick={() => {
                                          const courseInfo = getCourseInfo(course.courseId);
                                          setSelectedTeeTime(teeTime);
                                          setSelectedCourse({
                                            courseId: course.courseId,
                                            courseName: course.courseName,
                                            providerType: course.providerType,
                                            city: courseInfo?.city,
                                            contractSettings: course.contractSettings,
                                          });
                                          setSelectedDate(dateData.date);
                                          setPackageDialogOpen(true);
                                        }}
                                        data-testid={`button-teetime-${teeTime.id}`}
                                      >
                                        <div className="flex items-center gap-1 text-sm font-medium">
                                          <Clock className="h-3 w-3" />
                                          {teeTime.time.includes('T') 
                                            ? format(new Date(teeTime.time), 'HH:mm')
                                            : teeTime.time.slice(11, 16)}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                          <span className="flex items-center gap-0.5">
                                            <Users className="h-3 w-3" />
                                            {teeTime.players}
                                          </span>
                                          {teeTime.price > 0 && (
                                            <span className="flex items-center gap-0.5 text-primary font-medium">
                                              <Euro className="h-3 w-3" />
                                              {teeTime.price}
                                            </span>
                                          )}
                                        </div>
                                      </Button>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">No tee times available</p>
                                )}
                              </div>
                            ))}
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
                )
              ) : searchMutation.isPending ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <GolfLoader size="lg" text="Searching across courses..." />
                      <p className="text-sm text-muted-foreground mt-4">
                        This may take a moment as we check availability at each course
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : searchMutation.isError ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                        <Search className="h-6 w-6 text-destructive" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">Search Failed</h3>
                      <p className="text-muted-foreground max-w-md mx-auto mb-4">
                        {searchMutation.error?.message || 'Unable to fetch tee times. Please try again.'}
                      </p>
                      <Button onClick={handleSearch} variant="outline">
                        Try Again
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">Search Multiple Courses</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        Select the courses you're interested in, choose your date range,
                        and find the perfect tee time across all of them at once.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            
            <div className="hidden xl:block xl:col-span-1">
              <div className="sticky top-4">
                <CartSidebar />
              </div>
            </div>
          </div>
          
          {getItemCount() > 0 && (
            <div className="xl:hidden fixed bottom-4 right-4 z-50">
              <Button
                size="lg"
                className="rounded-full shadow-lg"
                onClick={() => navigate('/checkout')}
                data-testid="button-mobile-checkout"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {getItemCount()} items
              </Button>
            </div>
          )}
        </div>
      </div>
      
      <PackageSelectionDialog
        open={packageDialogOpen}
        onOpenChange={setPackageDialogOpen}
        teeTime={selectedTeeTime}
        course={selectedCourse}
        date={selectedDate}
      />
    </>
  );
}
