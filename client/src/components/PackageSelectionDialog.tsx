import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Clock, Users, Car, Utensils, Euro, ShoppingCart, Plus, AlertTriangle, Sunrise, Sunset, Snowflake, Sun, Leaf, Tag, Minus, Info } from "lucide-react";
import { useBookingCart, CartItem, BookingConflict } from "@/contexts/BookingCartContext";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Package {
  id: number | string;
  name: string;
  price?: number;
  description?: string;
  includesBuggy?: boolean;
  includesLunch?: boolean;
  isEarlyBird?: boolean;
  isTwilight?: boolean;
  maxPlayers?: number;
  minPlayers?: number;
  isMain?: boolean;
}

interface AddOn {
  id: number | string;
  name: string;
  price?: number;
  includesBuggy?: boolean;
  includesLunch?: boolean;
  category?: string;
  isAddOn?: boolean;
  pricingType?: 'per-player' | 'per-buggy';
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
  addOns?: AddOn[];
}

interface ContractSettings {
  twilightStartTime: string | null; // e.g., "14:00"
  earlyBirdEndTime: string | null;  // e.g., "10:00"
  currentSeason: string | null;     // e.g., "Winter", "Low Season"
}

interface CourseData {
  courseId: string;
  courseName: string;
  providerType: string;
  city?: string;
  contractSettings?: ContractSettings;
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
  // Map of addOn id -> quantity (0 = not selected)
  const [addOnQuantities, setAddOnQuantities] = useState<Map<string, number>>(new Map());
  const [acknowledgedConflicts, setAcknowledgedConflicts] = useState(false);
  const { addItem, hasItem, checkConflicts } = useBookingCart();
  const { toast } = useToast();

  useEffect(() => {
    setSelectedPackageId("");
    setAddOnQuantities(new Map());
    setAcknowledgedConflicts(false);
  }, [teeTime?.id, teeTime?.time]);

  if (!teeTime || !course) return null;

  const allPackages = teeTime.packages || [];
  const addOns = teeTime.addOns || [];
  
  // Get contract time settings or use defaults
  const contractSettings = course.contractSettings;
  const twilightStartTime = contractSettings?.twilightStartTime || '14:00';
  const earlyBirdEndTime = contractSettings?.earlyBirdEndTime || '10:00';
  const currentSeason = contractSettings?.currentSeason;
  
  // Parse time strings to minutes for accurate comparison (handles both 14:00 and 14:30)
  const parseTimeToMinutes = (time: string): number => {
    const parts = time.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    return hours * 60 + minutes;
  };
  
  const twilightStartMinutes = parseTimeToMinutes(twilightStartTime);
  const earlyBirdEndMinutes = parseTimeToMinutes(earlyBirdEndTime);
  const teeTimeDate = new Date(teeTime.time);
  const teeTimeMinutes = teeTimeDate.getHours() * 60 + teeTimeDate.getMinutes();
  
  // Helper to check if package is early bird or twilight
  const isEarlyBirdPackage = (pkg: Package) => 
    pkg.isEarlyBird || 
    pkg.name.toLowerCase().includes('early bird') ||
    pkg.name.toLowerCase().includes('earlybird') ||
    pkg.name.toLowerCase().includes('madrugador');
  
  const isTwilightPackage = (pkg: Package) => 
    pkg.isTwilight || 
    pkg.name.toLowerCase().includes('twilight') ||
    pkg.name.toLowerCase().includes('crepuscular');
  
  // Normalize package name to get base product (strip time-of-day suffixes)
  const getBaseProductName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/\s*(early\s*bird|earlybird|madrugador|twilight|crepuscular)\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  // Check if we're in early bird or twilight time window
  const isEarlyBirdTime = teeTimeMinutes < earlyBirdEndMinutes;
  const isTwilightTime = teeTimeMinutes >= twilightStartMinutes;
  
  // First pass: filter packages based on time windows
  const timeFilteredPackages = allPackages.filter(pkg => {
    // Twilight packages: only show if tee time is at or after twilight start
    if (isTwilightPackage(pkg) && !isTwilightTime) {
      return false;
    }
    
    // Early bird packages: only show if tee time is before early bird end
    if (isEarlyBirdPackage(pkg) && !isEarlyBirdTime) {
      return false;
    }
    
    return true;
  });
  
  // Second pass: when a discounted variant is available, hide the regular-priced equivalent
  // This prevents showing both "Greenfee + Buggy" (€320) and "Greenfee + Buggy Earlybird" (€280)
  const packages = timeFilteredPackages.filter(pkg => {
    // If this is a discounted package (early bird/twilight), keep it
    if (isEarlyBirdPackage(pkg) || isTwilightPackage(pkg)) {
      return true;
    }
    
    // For regular packages, check if there's a discounted variant available
    const baseName = getBaseProductName(pkg.name);
    
    // Check if there's an early bird version of this package (and we're in early bird time)
    if (isEarlyBirdTime) {
      const hasEarlyBirdVariant = timeFilteredPackages.some(other => 
        isEarlyBirdPackage(other) && getBaseProductName(other.name) === baseName
      );
      if (hasEarlyBirdVariant) {
        return false; // Hide regular, show early bird instead
      }
    }
    
    // Check if there's a twilight version of this package (and we're in twilight time)
    if (isTwilightTime) {
      const hasTwilightVariant = timeFilteredPackages.some(other => 
        isTwilightPackage(other) && getBaseProductName(other.name) === baseName
      );
      if (hasTwilightVariant) {
        return false; // Hide regular, show twilight instead
      }
    }
    
    return true;
  });
  
  const selectedPackage = packages.find(p => p.id?.toString() === selectedPackageId);
  const isAlreadyInCart = hasItem(course.courseId, teeTime.time);
  const conflicts = checkConflicts(course.courseId, date, teeTime.time);
  
  const getPackagePrice = (pkg: Package): number => {
    return pkg.price ?? teeTime.price ?? 0;
  };

  const getAddOnPrice = (addOn: AddOn): number => {
    const basePrice = addOn.price ?? 0;
    // Buggy is shared (1 per 2 players), other add-ons are per player
    if (addOn.pricingType === 'per-buggy' || addOn.includesBuggy) {
      return basePrice * Math.ceil(teeTime.players / 2);
    }
    return basePrice * teeTime.players;
  };

  const getAddOnPriceLabel = (addOn: AddOn): string => {
    if (addOn.pricingType === 'per-buggy' || addOn.includesBuggy) {
      return `€${addOn.price ?? 0}/buggy`;
    }
    return `€${addOn.price ?? 0}/player`;
  };

  // Determine add-on category for conflict detection
  const getAddOnCategory = (addOn: AddOn): 'buggy' | 'trolley' | 'clubs' | 'other' => {
    const nameLower = addOn.name.toLowerCase();
    if (nameLower.includes('buggy') || nameLower.includes('cart')) return 'buggy';
    if (nameLower.includes('trolley') || nameLower.includes('trundler')) return 'trolley';
    if (nameLower.includes('club') || nameLower.includes('rental')) return 'clubs';
    return 'other';
  };
  
  // Check if package already includes buggy
  const packageIncludesBuggy = selectedPackage?.includesBuggy || 
    selectedPackage?.name.toLowerCase().includes('buggy');
  
  // Get max quantity for an add-on based on its type
  const getMaxQuantity = (addOn: AddOn): number => {
    const category = getAddOnCategory(addOn);
    if (category === 'buggy') {
      // Buggies: max is ceil(players/2) since 2 share per buggy
      return Math.ceil(teeTime.players / 2);
    }
    // Trolleys and clubs: max is number of players
    return teeTime.players;
  };
  
  // Check if an add-on is in conflict with selected items
  const isAddOnConflicting = (addOn: AddOn): { conflicting: boolean; reason?: string } => {
    const category = getAddOnCategory(addOn);
    
    // If package includes buggy, buggy add-on is redundant
    if (category === 'buggy' && packageIncludesBuggy) {
      return { conflicting: true, reason: 'Already included in package' };
    }
    
    // Check buggy vs trolley conflict
    const hasBuggySelected = packageIncludesBuggy || 
      addOns.some(a => getAddOnCategory(a) === 'buggy' && (addOnQuantities.get(a.id?.toString()) || 0) > 0);
    const hasTrolleySelected = addOns.some(a => 
      getAddOnCategory(a) === 'trolley' && (addOnQuantities.get(a.id?.toString()) || 0) > 0
    );
    
    if (category === 'buggy' && hasTrolleySelected) {
      return { conflicting: true, reason: 'Cannot combine with trolley' };
    }
    if (category === 'trolley' && hasBuggySelected) {
      return { conflicting: true, reason: 'Buggy already selected' };
    }
    
    return { conflicting: false };
  };
  
  // Update quantity for an add-on
  const setAddOnQuantity = (addOnId: string, quantity: number) => {
    const addOn = addOns.find(a => a.id?.toString() === addOnId);
    if (!addOn) return;
    
    const category = getAddOnCategory(addOn);
    const newQuantities = new Map(addOnQuantities);
    
    if (quantity <= 0) {
      newQuantities.delete(addOnId);
    } else {
      const max = getMaxQuantity(addOn);
      newQuantities.set(addOnId, Math.min(quantity, max));
    }
    
    // If selecting buggy, clear all trolleys (and vice versa)
    if (quantity > 0) {
      if (category === 'buggy') {
        addOns.forEach(a => {
          if (getAddOnCategory(a) === 'trolley') {
            newQuantities.delete(a.id?.toString());
          }
        });
      } else if (category === 'trolley') {
        addOns.forEach(a => {
          if (getAddOnCategory(a) === 'buggy') {
            newQuantities.delete(a.id?.toString());
          }
        });
      }
    }
    
    setAddOnQuantities(newQuantities);
  };
  
  // Get the currently selected add-on quantity
  const getAddOnQuantity = (addOnId: string): number => {
    return addOnQuantities.get(addOnId) || 0;
  };

  // Calculate add-on price based on quantity and pricing type
  const calculateAddOnTotal = (addOn: AddOn, quantity: number): number => {
    const basePrice = addOn.price ?? 0;
    // Buggy is per-buggy, others are per-player
    if (addOn.pricingType === 'per-buggy' || addOn.includesBuggy || getAddOnCategory(addOn) === 'buggy') {
      return basePrice * quantity;
    }
    return basePrice * quantity;
  };
  
  const calculateTotal = (): number => {
    let total = 0;
    
    // Base package price
    if (selectedPackage) {
      total = getPackagePrice(selectedPackage) * teeTime.players;
    }
    
    // Add selected add-ons based on quantities
    addOnQuantities.forEach((quantity, addOnId) => {
      const addOn = addOns.find(a => a.id?.toString() === addOnId);
      if (addOn && quantity > 0) {
        total += calculateAddOnTotal(addOn, quantity);
      }
    });
    
    return total;
  };

  const handleAddToCart = () => {
    if (!selectedPackage) {
      toast({
        title: "Please select a package",
        description: "Choose a green fee package before adding to cart",
        variant: "destructive",
      });
      return;
    }

    // Build selected add-ons list with quantities
    const selectedAddOnsList: Array<{ addOn: AddOn; quantity: number }> = [];
    addOnQuantities.forEach((quantity, addOnId) => {
      const addOn = addOns.find(a => a.id?.toString() === addOnId);
      if (addOn && quantity > 0) {
        selectedAddOnsList.push({ addOn, quantity });
      }
    });
    
    // Check if any selected add-on includes buggy
    const hasBuggyAddOn = selectedAddOnsList.some(({ addOn }) => addOn.includesBuggy || getAddOnCategory(addOn) === 'buggy');
    const hasLunchAddOn = selectedAddOnsList.some(({ addOn }) => addOn.includesLunch);

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
        includesBuggy: selectedPackage.includesBuggy || hasBuggyAddOn,
        includesLunch: selectedPackage.includesLunch || hasLunchAddOn,
      },
      addOns: selectedAddOnsList.map(({ addOn, quantity }) => ({
        id: addOn.id,
        name: addOn.name,
        price: addOn.price ?? 0,
        quantity: quantity,
        totalPrice: calculateAddOnTotal(addOn, quantity),
      })),
      totalPrice: calculateTotal(),
      providerType: course.providerType,
    };

    addItem(cartItem);
    
    toast({
      title: "Added to cart",
      description: `${course.courseName} at ${format(new Date(teeTime.time), 'HH:mm')} on ${format(new Date(date), 'MMM d')}`,
    });

    onOpenChange(false);
    setSelectedPackageId("");
    setSelectedAddOns(new Set());
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
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto" data-testid="dialog-package-selection">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {formatTime(teeTime.time)}
          </DialogTitle>
          <DialogDescription className="space-y-2">
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
            {/* Show current season badge */}
            {currentSeason && (
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="outline" className="text-xs bg-background">
                  {currentSeason.toLowerCase().includes('winter') && <Snowflake className="h-3 w-3 mr-1 text-blue-500" />}
                  {currentSeason.toLowerCase().includes('summer') && <Sun className="h-3 w-3 mr-1 text-yellow-500" />}
                  {(currentSeason.toLowerCase().includes('mid') || currentSeason.toLowerCase().includes('spring') || currentSeason.toLowerCase().includes('autumn')) && <Leaf className="h-3 w-3 mr-1 text-green-500" />}
                  {!currentSeason.toLowerCase().includes('winter') && !currentSeason.toLowerCase().includes('summer') && !currentSeason.toLowerCase().includes('mid') && !currentSeason.toLowerCase().includes('spring') && !currentSeason.toLowerCase().includes('autumn') && <Tag className="h-3 w-3 mr-1" />}
                  {currentSeason} Rate
                </Badge>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-4">
          {/* Main Package Selection */}
          <div>
            <h4 className="text-sm font-medium mb-3">Select Green Fee Package</h4>
            
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
                          {isEarlyBirdPackage(pkg) && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 bg-orange-50">
                              <Sunrise className="h-3 w-3 mr-1" />
                              Early Bird (before {earlyBirdEndTime})
                            </Badge>
                          )}
                          {isTwilightPackage(pkg) && (
                            <Badge variant="outline" className="text-xs text-purple-600 border-purple-300 bg-purple-50">
                              <Sunset className="h-3 w-3 mr-1" />
                              Twilight (from {twilightStartTime})
                            </Badge>
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

          {/* Optional Add-ons */}
          {addOns.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Optional Add-ons
                </h4>
                
                {/* Info about buggy already included */}
                {packageIncludesBuggy && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 p-2 rounded bg-muted/50">
                    <Info className="h-3 w-3" />
                    Your package includes buggy - transport add-ons not needed
                  </div>
                )}
                
                <div className="space-y-2">
                  {addOns.map((addOn) => {
                    const addOnId = addOn.id?.toString() || '';
                    const quantity = getAddOnQuantity(addOnId);
                    const category = getAddOnCategory(addOn);
                    const conflict = isAddOnConflicting(addOn);
                    const maxQty = getMaxQuantity(addOn);
                    const unitPrice = addOn.price ?? 0;
                    const totalForAddOn = calculateAddOnTotal(addOn, quantity);
                    
                    // Hide buggy add-ons if package includes buggy
                    if (category === 'buggy' && packageIncludesBuggy) {
                      return null;
                    }
                    
                    const isDisabled = conflict.conflicting && quantity === 0;
                    
                    return (
                      <div
                        key={addOn.id}
                        className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                          quantity > 0
                            ? 'border-primary bg-primary/5'
                            : isDisabled
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover-elevate'
                        }`}
                        data-testid={`addon-option-${addOn.id}`}
                      >
                        {/* Quantity Selector */}
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            disabled={quantity === 0 || isDisabled}
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddOnQuantity(addOnId, quantity - 1);
                            }}
                            data-testid={`button-addon-minus-${addOn.id}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-medium">
                            {quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            disabled={quantity >= maxQty || isDisabled}
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddOnQuantity(addOnId, quantity + 1);
                            }}
                            data-testid={`button-addon-plus-${addOn.id}`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <div className="flex-1 space-y-1">
                          <div className="text-sm font-medium">
                            {addOn.name}
                          </div>
                          {addOn.category && (
                            <div className="text-xs text-muted-foreground">
                              {addOn.category}
                            </div>
                          )}
                          {conflict.conflicting && quantity === 0 && (
                            <div className="text-xs text-orange-600">
                              {conflict.reason}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {category === 'buggy' && (
                              <Badge variant="secondary" className="text-xs">
                                <Car className="h-3 w-3 mr-1" />
                                {maxQty === 1 ? '1-2 players share' : `${maxQty} buggies max`}
                              </Badge>
                            )}
                            {category === 'trolley' && (
                              <Badge variant="secondary" className="text-xs">
                                Per player
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          {quantity > 0 ? (
                            <>
                              <div className="text-sm font-medium text-primary">
                                +€{totalForAddOn}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                €{unitPrice} × {quantity}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-sm font-medium">
                                €{unitPrice}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {category === 'buggy' ? 'per buggy' : 'per player'}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Total Summary */}
          {selectedPackage && (
            <>
              <Separator />
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-xl font-bold text-primary">
                    €{calculateTotal()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {selectedPackage.name} ({teeTime.players} players)
                  {addOnQuantities.size > 0 && ` + ${addOnQuantities.size} add-on${addOnQuantities.size > 1 ? 's' : ''}`}
                </div>
              </div>
            </>
          )}

          {/* Conflict Warnings */}
          {conflicts.length > 0 && (
            <div className="space-y-2">
              {conflicts.map((conflict, idx) => (
                <Alert key={idx} variant="destructive" data-testid={`alert-conflict-${idx}`}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    {conflict.type === 'same-course-same-day' 
                      ? 'Second Round at Same Course' 
                      : 'Time Conflict - Cannot Book'}
                  </AlertTitle>
                  <AlertDescription className="text-sm">
                    {conflict.message}
                  </AlertDescription>
                </Alert>
              ))}
              
              {/* Only allow acknowledgement for same-course warnings, NOT time overlaps */}
              {!conflicts.some(c => c.type === 'time-overlap') && (
                <div className="flex items-start space-x-2 p-3 rounded-lg border border-destructive/50 bg-destructive/5">
                  <Checkbox 
                    id="acknowledge-conflict"
                    checked={acknowledgedConflicts}
                    onCheckedChange={(checked) => setAcknowledgedConflicts(checked === true)}
                    data-testid="checkbox-acknowledge-conflict"
                  />
                  <Label 
                    htmlFor="acknowledge-conflict" 
                    className="text-sm cursor-pointer leading-tight"
                  >
                    I understand and want to proceed with a second round
                  </Label>
                </div>
              )}
            </div>
          )}
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
            disabled={
              (packages.length > 0 && !selectedPackageId) || 
              conflicts.some(c => c.type === 'time-overlap') ||
              (conflicts.some(c => c.type === 'same-course-same-day') && !acknowledgedConflicts)
            }
            className="flex-1"
            data-testid="button-add-to-cart"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {conflicts.some(c => c.type === 'time-overlap') 
              ? 'Time Conflict' 
              : isAlreadyInCart 
                ? 'Update Cart' 
                : 'Add to Cart'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
