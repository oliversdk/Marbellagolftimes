import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Clock, Users, MapPin, Car, Utensils, Check, Euro, ShoppingCart } from "lucide-react";
import { useBookingCart, CartItem, CartPackage } from "@/contexts/BookingCartContext";
import { useToast } from "@/hooks/use-toast";

interface Package {
  id: number;
  name: string;
  price?: number;
  description?: string;
  includesBuggy?: boolean;
  includesLunch?: boolean;
  isEarlyBird?: boolean;
  isTwilight?: boolean;
  maxPlayers?: number;
  minPlayers?: number;
}

interface TeeTimeData {
  id: string | number;
  time: string;
  price: number;
  currency: string;
  players: number;
  holes: number;
  source: string;
  packages?: Package[];
}

interface CourseData {
  courseId: string;
  courseName: string;
  providerType: string;
  city?: string;
}

interface PackageSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teeTime: TeeTimeData | null;
  course: CourseData | null;
  date: string;
}

export function PackageSelectionDialog({
  open,
  onOpenChange,
  teeTime,
  course,
  date,
}: PackageSelectionDialogProps) {
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const { addItem, hasItem } = useBookingCart();
  const { toast } = useToast();

  if (!teeTime || !course) return null;

  const packages = teeTime.packages || [];
  const selectedPackage = packages.find(p => p.id?.toString() === selectedPackageId);
  const isAlreadyInCart = hasItem(course.courseId, teeTime.time);
  
  const getPackagePrice = (pkg: Package): number => {
    return pkg.price ?? teeTime.price ?? 0;
  };

  const handleAddToCart = () => {
    if (!selectedPackage) {
      toast({
        title: "Please select a package",
        description: "Choose a package option before adding to cart",
        variant: "destructive",
      });
      return;
    }

    const cartItem: CartItem = {
      id: `${course.courseId}-${teeTime.time}-${Date.now()}`,
      courseId: course.courseId,
      courseName: course.courseName,
      date: date,
      time: teeTime.time,
      players: teeTime.players,
      package: {
        id: selectedPackage.id,
        name: selectedPackage.name,
        price: getPackagePrice(selectedPackage),
        includesBuggy: selectedPackage.includesBuggy,
        includesLunch: selectedPackage.includesLunch,
      },
      totalPrice: getPackagePrice(selectedPackage) * teeTime.players,
      providerType: course.providerType,
    };

    addItem(cartItem);
    
    toast({
      title: "Added to cart",
      description: `${course.courseName} at ${format(new Date(teeTime.time), 'HH:mm')} on ${format(new Date(date), 'MMM d')}`,
    });

    onOpenChange(false);
    setSelectedPackageId("");
  };

  const formatTime = (timeStr: string) => {
    try {
      return format(new Date(timeStr), 'HH:mm');
    } catch {
      return timeStr.slice(11, 16);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-package-selection">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {formatTime(teeTime.time)}
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{course.courseName}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {teeTime.players} players
              </span>
              <span>{format(new Date(date), 'EEEE, MMMM d')}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Select Package</h4>
            
            {packages.length > 0 ? (
              <RadioGroup 
                value={selectedPackageId} 
                onValueChange={setSelectedPackageId}
                className="space-y-2"
              >
                {packages.map((pkg) => {
                  const price = getPackagePrice(pkg);
                  const totalPrice = price * teeTime.players;
                  
                  return (
                    <div
                      key={pkg.id}
                      className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        selectedPackageId === pkg.id?.toString()
                          ? 'border-primary bg-primary/5'
                          : 'hover-elevate'
                      }`}
                      onClick={() => setSelectedPackageId(pkg.id?.toString() || "")}
                      data-testid={`package-option-${pkg.id}`}
                    >
                      <RadioGroupItem value={pkg.id?.toString() || ""} id={`pkg-${pkg.id}`} className="mt-1" />
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`pkg-${pkg.id}`} className="text-sm font-medium cursor-pointer">
                          {pkg.name}
                        </Label>
                        
                        <div className="flex flex-wrap gap-1.5">
                          {pkg.includesBuggy && (
                            <Badge variant="secondary" className="text-xs">
                              <Car className="h-3 w-3 mr-1" />
                              Buggy
                            </Badge>
                          )}
                          {pkg.includesLunch && (
                            <Badge variant="secondary" className="text-xs">
                              <Utensils className="h-3 w-3 mr-1" />
                              Lunch
                            </Badge>
                          )}
                          {pkg.isEarlyBird && (
                            <Badge variant="outline" className="text-xs">Early Bird</Badge>
                          )}
                          {pkg.isTwilight && (
                            <Badge variant="outline" className="text-xs">Twilight</Badge>
                          )}
                        </div>
                        
                        {pkg.description && (
                          <p className="text-xs text-muted-foreground">{pkg.description}</p>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-medium flex items-center gap-0.5">
                          <Euro className="h-3 w-3" />
                          {price}
                        </div>
                        <div className="text-xs text-muted-foreground">per player</div>
                        <div className="text-xs font-medium text-primary mt-1">
                          Total: €{totalPrice}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>
            ) : (
              <div className="rounded-lg border p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">Standard Rate</p>
                <div className="text-2xl font-bold flex items-center justify-center gap-1">
                  <Euro className="h-5 w-5" />
                  {teeTime.price}
                </div>
                <p className="text-xs text-muted-foreground">per player</p>
                <p className="text-sm font-medium text-primary mt-2">
                  Total: €{teeTime.price * teeTime.players}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddToCart}
            disabled={packages.length > 0 && !selectedPackageId}
            className="flex-1"
            data-testid="button-add-to-cart"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {isAlreadyInCart ? 'Update Cart' : 'Add to Cart'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
