import { useState, useEffect, useRef, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
// Use CDN path for optimized WebP delivery
const defaultPlaceholder = "/generated_images/Premium_Spanish_golf_signature_hole_153a6079.png";

interface ImageVersions {
  desktop: string;
  mobile: string;
  thumbnail: string;
}

// Inline image versions map - eliminates API call that was causing 6s LCP delay
const imageVersions: Record<string, ImageVersions> = {
  "Aerial_coastal_golf_course_view_65614db9.png": { desktop: "/cdn/images/Aerial_coastal_golf_course_view_65614db9-desktop.webp", mobile: "/cdn/images/Aerial_coastal_golf_course_view_65614db9-mobile.webp", thumbnail: "/cdn/images/Aerial_coastal_golf_course_view_65614db9-thumb.webp" },
  "Cascading_waterfall_feature_35d05b82.png": { desktop: "/cdn/images/Cascading_waterfall_feature_35d05b82-desktop.webp", mobile: "/cdn/images/Cascading_waterfall_feature_35d05b82-mobile.webp", thumbnail: "/cdn/images/Cascading_waterfall_feature_35d05b82-thumb.webp" },
  "Castle_historic_background_1a975ee0.png": { desktop: "/cdn/images/Castle_historic_background_1a975ee0-desktop.webp", mobile: "/cdn/images/Castle_historic_background_1a975ee0-mobile.webp", thumbnail: "/cdn/images/Castle_historic_background_1a975ee0-thumb.webp" },
  "Championship_tournament_grandstand_cf147fe9.png": { desktop: "/cdn/images/Championship_tournament_grandstand_cf147fe9-desktop.webp", mobile: "/cdn/images/Championship_tournament_grandstand_cf147fe9-mobile.webp", thumbnail: "/cdn/images/Championship_tournament_grandstand_cf147fe9-thumb.webp" },
  "Clubhouse_veranda_mountain_a00733a5.png": { desktop: "/cdn/images/Clubhouse_veranda_mountain_a00733a5-desktop.webp", mobile: "/cdn/images/Clubhouse_veranda_mountain_a00733a5-mobile.webp", thumbnail: "/cdn/images/Clubhouse_veranda_mountain_a00733a5-thumb.webp" },
  "Coastal_bunker_ocean_view_a3735d23.png": { desktop: "/cdn/images/Coastal_bunker_ocean_view_a3735d23-desktop.webp", mobile: "/cdn/images/Coastal_bunker_ocean_view_a3735d23-mobile.webp", thumbnail: "/cdn/images/Coastal_bunker_ocean_view_a3735d23-thumb.webp" },
  "Costa_del_Sol_golf_course_sunrise_89864b9c.png": { desktop: "/cdn/images/Costa_del_Sol_golf_course_sunrise_89864b9c-desktop.webp", mobile: "/cdn/images/Costa_del_Sol_golf_course_sunrise_89864b9c-mobile.webp", thumbnail: "/cdn/images/Costa_del_Sol_golf_course_sunrise_89864b9c-thumb.webp" },
  "Cypress_shadows_Tuscan_hills_3f3e9d43.png": { desktop: "/cdn/images/Cypress_shadows_Tuscan_hills_3f3e9d43-desktop.webp", mobile: "/cdn/images/Cypress_shadows_Tuscan_hills_3f3e9d43-mobile.webp", thumbnail: "/cdn/images/Cypress_shadows_Tuscan_hills_3f3e9d43-thumb.webp" },
  "Daytime_Costa_del_Sol_golf_walk_d48fdca9.png": { desktop: "/cdn/images/Daytime_Costa_del_Sol_golf_walk_d48fdca9-desktop.webp", mobile: "/cdn/images/Daytime_Costa_del_Sol_golf_walk_d48fdca9-mobile.webp", thumbnail: "/cdn/images/Daytime_Costa_del_Sol_golf_walk_d48fdca9-thumb.webp" },
  "Desert_rock_formations_f69c5d18.png": { desktop: "/cdn/images/Desert_rock_formations_f69c5d18-desktop.webp", mobile: "/cdn/images/Desert_rock_formations_f69c5d18-mobile.webp", thumbnail: "/cdn/images/Desert_rock_formations_f69c5d18-thumb.webp" },
  "Dogleg_par_5_aerial_f691a2d3.png": { desktop: "/cdn/images/Dogleg_par_5_aerial_f691a2d3-desktop.webp", mobile: "/cdn/images/Dogleg_par_5_aerial_f691a2d3-mobile.webp", thumbnail: "/cdn/images/Dogleg_par_5_aerial_f691a2d3-thumb.webp" },
  "Dramatic_seaside_cliffs_f029f091.png": { desktop: "/cdn/images/Dramatic_seaside_cliffs_f029f091-desktop.webp", mobile: "/cdn/images/Dramatic_seaside_cliffs_f029f091-mobile.webp", thumbnail: "/cdn/images/Dramatic_seaside_cliffs_f029f091-thumb.webp" },
  "Dunes_green_grass_bunkers_598731ad.png": { desktop: "/cdn/images/Dunes_green_grass_bunkers_598731ad-desktop.webp", mobile: "/cdn/images/Dunes_green_grass_bunkers_598731ad-mobile.webp", thumbnail: "/cdn/images/Dunes_green_grass_bunkers_598731ad-thumb.webp" },
  "Elevated_tee_valley_vista_9d043485.png": { desktop: "/cdn/images/Elevated_tee_valley_vista_9d043485-desktop.webp", mobile: "/cdn/images/Elevated_tee_valley_vista_9d043485-mobile.webp", thumbnail: "/cdn/images/Elevated_tee_valley_vista_9d043485-thumb.webp" },
  "Eucalyptus_forest_corridor_791aa351.png": { desktop: "/cdn/images/Eucalyptus_forest_corridor_791aa351-desktop.webp", mobile: "/cdn/images/Eucalyptus_forest_corridor_791aa351-mobile.webp", thumbnail: "/cdn/images/Eucalyptus_forest_corridor_791aa351-thumb.webp" },
  "FG_favicon_monogram_only_115479f5.png": { desktop: "/cdn/images/FG_favicon_monogram_only_115479f5-desktop.webp", mobile: "/cdn/images/FG_favicon_monogram_only_115479f5-mobile.webp", thumbnail: "/cdn/images/FG_favicon_monogram_only_115479f5-thumb.webp" },
  "FG_monogram_logo_design_121c7712.png": { desktop: "/cdn/images/FG_monogram_logo_design_121c7712-desktop.webp", mobile: "/cdn/images/FG_monogram_logo_design_121c7712-mobile.webp", thumbnail: "/cdn/images/FG_monogram_logo_design_121c7712-thumb.webp" },
  "Flamingos_water_hazard_504cdf6e.png": { desktop: "/cdn/images/Flamingos_water_hazard_504cdf6e-desktop.webp", mobile: "/cdn/images/Flamingos_water_hazard_504cdf6e-mobile.webp", thumbnail: "/cdn/images/Flamingos_water_hazard_504cdf6e-thumb.webp" },
  "Golf_academy_driving_range_4506e503.png": { desktop: "/cdn/images/Golf_academy_driving_range_4506e503-desktop.webp", mobile: "/cdn/images/Golf_academy_driving_range_4506e503-mobile.webp", thumbnail: "/cdn/images/Golf_academy_driving_range_4506e503-thumb.webp" },
  "Island_green_water_feature_cba96746.png": { desktop: "/cdn/images/Island_green_water_feature_cba96746-desktop.webp", mobile: "/cdn/images/Island_green_water_feature_cba96746-mobile.webp", thumbnail: "/cdn/images/Island_green_water_feature_cba96746-thumb.webp" },
  "Island_par_3_bridge_63fb85b9.png": { desktop: "/cdn/images/Island_par_3_bridge_63fb85b9-desktop.webp", mobile: "/cdn/images/Island_par_3_bridge_63fb85b9-mobile.webp", thumbnail: "/cdn/images/Island_par_3_bridge_63fb85b9-thumb.webp" },
  "Japanese_garden_zen_elements_bc1d6523.png": { desktop: "/cdn/images/Japanese_garden_zen_elements_bc1d6523-desktop.webp", mobile: "/cdn/images/Japanese_garden_zen_elements_bc1d6523-mobile.webp", thumbnail: "/cdn/images/Japanese_garden_zen_elements_bc1d6523-thumb.webp" },
  "Lake_fountain_signature_hole_8bf0b968.png": { desktop: "/cdn/images/Lake_fountain_signature_hole_8bf0b968-desktop.webp", mobile: "/cdn/images/Lake_fountain_signature_hole_8bf0b968-mobile.webp", thumbnail: "/cdn/images/Lake_fountain_signature_hole_8bf0b968-thumb.webp" },
  "Lavender_field_cart_path_e4bc5d25.png": { desktop: "/cdn/images/Lavender_field_cart_path_e4bc5d25-desktop.webp", mobile: "/cdn/images/Lavender_field_cart_path_e4bc5d25-mobile.webp", thumbnail: "/cdn/images/Lavender_field_cart_path_e4bc5d25-thumb.webp" },
  "Minimalist_modern_architecture_a6f85524.png": { desktop: "/cdn/images/Minimalist_modern_architecture_a6f85524-desktop.webp", mobile: "/cdn/images/Minimalist_modern_architecture_a6f85524-mobile.webp", thumbnail: "/cdn/images/Minimalist_modern_architecture_a6f85524-thumb.webp" },
  "Misty_sunrise_fairway_f4daefff.png": { desktop: "/cdn/images/Misty_sunrise_fairway_f4daefff-desktop.webp", mobile: "/cdn/images/Misty_sunrise_fairway_f4daefff-mobile.webp", thumbnail: "/cdn/images/Misty_sunrise_fairway_f4daefff-thumb.webp" },
  "Modern_clubhouse_mountain_view_2032acdf.png": { desktop: "/cdn/images/Modern_clubhouse_mountain_view_2032acdf-desktop.webp", mobile: "/cdn/images/Modern_clubhouse_mountain_view_2032acdf-mobile.webp", thumbnail: "/cdn/images/Modern_clubhouse_mountain_view_2032acdf-thumb.webp" },
  "Narrow_strategic_fairway_c329dbbf.png": { desktop: "/cdn/images/Narrow_strategic_fairway_c329dbbf-desktop.webp", mobile: "/cdn/images/Narrow_strategic_fairway_c329dbbf-mobile.webp", thumbnail: "/cdn/images/Narrow_strategic_fairway_c329dbbf-thumb.webp" },
  "Night_golf_dramatic_lighting_1f4a3df9.png": { desktop: "/cdn/images/Night_golf_dramatic_lighting_1f4a3df9-desktop.webp", mobile: "/cdn/images/Night_golf_dramatic_lighting_1f4a3df9-mobile.webp", thumbnail: "/cdn/images/Night_golf_dramatic_lighting_1f4a3df9-thumb.webp" },
  "Olive_tree_lined_fairway_35bef37a.png": { desktop: "/cdn/images/Olive_tree_lined_fairway_35bef37a-desktop.webp", mobile: "/cdn/images/Olive_tree_lined_fairway_35bef37a-mobile.webp", thumbnail: "/cdn/images/Olive_tree_lined_fairway_35bef37a-thumb.webp" },
  "Orange_grove_fairway_2750cd17.png": { desktop: "/cdn/images/Orange_grove_fairway_2750cd17-desktop.webp", mobile: "/cdn/images/Orange_grove_fairway_2750cd17-mobile.webp", thumbnail: "/cdn/images/Orange_grove_fairway_2750cd17-thumb.webp" },
  "Owner_perspective_sunrise_golf_walk_05244202.png": { desktop: "/cdn/images/Owner_perspective_sunrise_golf_walk_05244202-desktop.webp", mobile: "/cdn/images/Owner_perspective_sunrise_golf_walk_05244202-mobile.webp", thumbnail: "/cdn/images/Owner_perspective_sunrise_golf_walk_05244202-thumb.webp" },
  "Practice_putting_green_0a4cc6df.png": { desktop: "/cdn/images/Practice_putting_green_0a4cc6df-desktop.webp", mobile: "/cdn/images/Practice_putting_green_0a4cc6df-mobile.webp", thumbnail: "/cdn/images/Practice_putting_green_0a4cc6df-thumb.webp" },
  "Premium_Spanish_golf_signature_hole_153a6079.png": { desktop: "/cdn/images/Premium_Spanish_golf_signature_hole_153a6079-desktop.webp", mobile: "/cdn/images/Premium_Spanish_golf_signature_hole_153a6079-mobile.webp", thumbnail: "/cdn/images/Premium_Spanish_golf_signature_hole_153a6079-thumb.webp" },
  "Rainbow_after_storm_green_68eec4eb.png": { desktop: "/cdn/images/Rainbow_after_storm_green_68eec4eb-desktop.webp", mobile: "/cdn/images/Rainbow_after_storm_green_68eec4eb-mobile.webp", thumbnail: "/cdn/images/Rainbow_after_storm_green_68eec4eb-thumb.webp" },
  "Red_rock_canyon_course_377bc8ce.png": { desktop: "/cdn/images/Red_rock_canyon_course_377bc8ce-desktop.webp", mobile: "/cdn/images/Red_rock_canyon_course_377bc8ce-mobile.webp", thumbnail: "/cdn/images/Red_rock_canyon_course_377bc8ce-thumb.webp" },
  "Red_sand_bunker_feature_30f83d4b.png": { desktop: "/cdn/images/Red_sand_bunker_feature_30f83d4b-desktop.webp", mobile: "/cdn/images/Red_sand_bunker_feature_30f83d4b-mobile.webp", thumbnail: "/cdn/images/Red_sand_bunker_feature_30f83d4b-thumb.webp" },
  "Resort_pool_golf_view_4e3e8823.png": { desktop: "/cdn/images/Resort_pool_golf_view_4e3e8823-desktop.webp", mobile: "/cdn/images/Resort_pool_golf_view_4e3e8823-mobile.webp", thumbnail: "/cdn/images/Resort_pool_golf_view_4e3e8823-thumb.webp" },
  "Scottish_links_pot_bunkers_6cfb95d6.png": { desktop: "/cdn/images/Scottish_links_pot_bunkers_6cfb95d6-desktop.webp", mobile: "/cdn/images/Scottish_links_pot_bunkers_6cfb95d6-mobile.webp", thumbnail: "/cdn/images/Scottish_links_pot_bunkers_6cfb95d6-thumb.webp" },
  "Snow_mountains_alpine_vista_185e1bfc.png": { desktop: "/cdn/images/Snow_mountains_alpine_vista_185e1bfc-desktop.webp", mobile: "/cdn/images/Snow_mountains_alpine_vista_185e1bfc-mobile.webp", thumbnail: "/cdn/images/Snow_mountains_alpine_vista_185e1bfc-thumb.webp" },
  "Stone_bridge_stream_crossing_ed5e3c5e.png": { desktop: "/cdn/images/Stone_bridge_stream_crossing_ed5e3c5e-desktop.webp", mobile: "/cdn/images/Stone_bridge_stream_crossing_ed5e3c5e-mobile.webp", thumbnail: "/cdn/images/Stone_bridge_stream_crossing_ed5e3c5e-thumb.webp" },
  "Sunset_silhouette_putting_6142b7a3.png": { desktop: "/cdn/images/Sunset_silhouette_putting_6142b7a3-desktop.webp", mobile: "/cdn/images/Sunset_silhouette_putting_6142b7a3-mobile.webp", thumbnail: "/cdn/images/Sunset_silhouette_putting_6142b7a3-thumb.webp" },
  "Terrace_panoramic_coastline_4558abef.png": { desktop: "/cdn/images/Terrace_panoramic_coastline_4558abef-desktop.webp", mobile: "/cdn/images/Terrace_panoramic_coastline_4558abef-mobile.webp", thumbnail: "/cdn/images/Terrace_panoramic_coastline_4558abef-thumb.webp" },
  "Twilight_moonlit_evening_07522490.png": { desktop: "/cdn/images/Twilight_moonlit_evening_07522490-desktop.webp", mobile: "/cdn/images/Twilight_moonlit_evening_07522490-mobile.webp", thumbnail: "/cdn/images/Twilight_moonlit_evening_07522490-thumb.webp" },
  "Valderrama_aerial_sunset_view_d9530718.png": { desktop: "/cdn/images/Valderrama_aerial_sunset_view_d9530718-desktop.webp", mobile: "/cdn/images/Valderrama_aerial_sunset_view_d9530718-mobile.webp", thumbnail: "/cdn/images/Valderrama_aerial_sunset_view_d9530718-thumb.webp" },
  "Vineyard_hillside_course_726f3cbf.png": { desktop: "/cdn/images/Vineyard_hillside_course_726f3cbf-desktop.webp", mobile: "/cdn/images/Vineyard_hillside_course_726f3cbf-mobile.webp", thumbnail: "/cdn/images/Vineyard_hillside_course_726f3cbf-thumb.webp" },
  "Wetlands_boardwalk_par_3_ae8169db.png": { desktop: "/cdn/images/Wetlands_boardwalk_par_3_ae8169db-desktop.webp", mobile: "/cdn/images/Wetlands_boardwalk_par_3_ae8169db-mobile.webp", thumbnail: "/cdn/images/Wetlands_boardwalk_par_3_ae8169db-thumb.webp" },
  "Wildflower_meadow_borders_0d5abb75.png": { desktop: "/cdn/images/Wildflower_meadow_borders_0d5abb75-desktop.webp", mobile: "/cdn/images/Wildflower_meadow_borders_0d5abb75-mobile.webp", thumbnail: "/cdn/images/Wildflower_meadow_borders_0d5abb75-thumb.webp" },
  "Windswept_coastal_links_3c1fac7e.png": { desktop: "/cdn/images/Windswept_coastal_links_3c1fac7e-desktop.webp", mobile: "/cdn/images/Windswept_coastal_links_3c1fac7e-mobile.webp", thumbnail: "/cdn/images/Windswept_coastal_links_3c1fac7e-thumb.webp" }
};

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  className?: string;
  skeletonClassName?: string;
  fallbackSrc?: string;
  onImageLoad?: () => void;
  onImageError?: () => void;
  priority?: boolean;
  size?: "thumbnail" | "mobile" | "desktop" | "auto";
}

function getImageFilename(src: string): string | null {
  if (!src) return null;
  const parts = src.split("/");
  const filename = parts[parts.length - 1];
  if (filename.endsWith(".png") || filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
    return filename;
  }
  return null;
}

export function OptimizedImage({
  src,
  alt,
  className,
  skeletonClassName,
  fallbackSrc = defaultPlaceholder,
  onImageLoad,
  onImageError,
  priority = false,
  size = "auto",
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' && window.innerWidth < 768
  );
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  // Check if image is already loaded from cache on mount/src change
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img?.naturalWidth > 0) {
      setIsLoaded(true);
    }
  });

  const handleLoad = () => {
    setIsLoaded(true);
    onImageLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onImageError?.();
  };

  const getOptimizedSrc = (): string => {
    if (hasError) return fallbackSrc;
    if (!src) return fallbackSrc;
    
    const filename = getImageFilename(src);
    if (!filename || !imageVersions[filename]) {
      return src;
    }

    const versions = imageVersions[filename];
    
    switch (size) {
      case "thumbnail":
        return versions.thumbnail;
      case "mobile":
        return versions.mobile;
      case "desktop":
        return versions.desktop;
      case "auto":
      default:
        return isMobile ? versions.mobile : versions.desktop;
    }
  };

  const imageSrc = getOptimizedSrc();

  if (!src && !hasError) {
    return (
      <div className={cn("relative shrink-0 bg-muted flex items-center justify-center", className)}>
        <img src={fallbackSrc} alt={alt} className={cn("object-cover", className)} {...props} />
      </div>
    );
  }

  return (
    <div className={cn("relative shrink-0 overflow-hidden", className)}>
      {!isLoaded && (
        <Skeleton 
          className={cn("absolute inset-0 z-10 rounded-md", skeletonClassName)} 
          data-testid="img-skeleton"
        />
      )}
      <img
        ref={imgRef}
        key={imageSrc}
        src={imageSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        onLoad={handleLoad}
        onError={handleError}
        className="w-full h-full object-cover"
        {...props}
      />
    </div>
  );
}
