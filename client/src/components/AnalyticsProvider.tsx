import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const trackingId = import.meta.env.VITE_GA_TRACKING_ID as string | undefined;
  const initialPageTracked = useRef(false);
  const [location] = useLocation();
  const previousLocation = useRef<string | null>(null);

  useEffect(() => {
    if (!trackingId) return;

    if (window.gtag) {
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = function (...args: any[]) {
      window.dataLayer!.push(args);
    };

    window.gtag('js', new Date());
    window.gtag('config', trackingId, {
      send_page_view: false,
      anonymize_ip: true,
    });

    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
    script.async = true;

    script.onload = () => {
      if (!initialPageTracked.current && window.gtag) {
        window.gtag('config', trackingId, {
          page_path: window.location.pathname,
        });
        initialPageTracked.current = true;
        previousLocation.current = window.location.pathname;
      }
    };

    document.head.appendChild(script);
  }, [trackingId]);

  useEffect(() => {
    if (!trackingId || !window.gtag || !initialPageTracked.current) return;
    
    if (previousLocation.current === location) return;

    window.gtag('config', trackingId, {
      page_path: location,
    });
    previousLocation.current = location;
  }, [location, trackingId]);

  return <>{children}</>;
}
