import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import type { CourseWithSlots } from "@shared/schema";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons in Leaflet
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface CoursesMapProps {
  courses: CourseWithSlots[];
  center: { lat: number; lng: number };
  onCourseSelect?: (courseId: string) => void;
}

function MapUpdater({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], 10);
  }, [center.lat, center.lng, map]);
  return null;
}

export function CoursesMap({ courses, center, onCourseSelect }: CoursesMapProps) {
  const getMinPrice = (course: CourseWithSlots): number | null => {
    if (course.slots.length === 0) return null;
    return Math.min(...course.slots.map(s => s.greenFee));
  };

  return (
    <div className="h-[600px] rounded-lg overflow-hidden border">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <MapUpdater center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {courses.map((course) => {
          if (!course.course?.lat || !course.course?.lng) return null;
          
          const lat = parseFloat(course.course.lat);
          const lng = parseFloat(course.course.lng);
          const minPrice = getMinPrice(course);
          
          return (
            <Marker
              key={course.courseId}
              position={[lat, lng]}
              eventHandlers={{
                click: () => onCourseSelect?.(course.courseId),
              }}
            >
              <Popup>
                <div className="min-w-[250px]" data-testid={`map-popup-${course.courseId}`}>
                  {course.course?.imageUrl && (
                    <img
                      src={course.course.imageUrl}
                      alt={course.courseName}
                      className="w-full h-32 object-cover rounded-md mb-2"
                    />
                  )}
                  <h3 className="font-semibold mb-1">{course.courseName}</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    {course.course?.city}, {course.course?.province}
                  </p>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">
                      {course.distanceKm != null ? `${course.distanceKm.toFixed(1)} km` : "--"}
                    </Badge>
                    {minPrice !== null && (
                      <Badge>From €{minPrice}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {course.slots.length} tee {course.slots.length === 1 ? 'time' : 'times'} available
                  </p>
                  {course.providerType === "DEEP_LINK" && (
                    <Badge variant="outline" className="text-xs mb-2">
                      Direct Booking
                    </Badge>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
