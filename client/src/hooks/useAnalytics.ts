import { useCallback } from 'react';

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

export function useAnalytics() {
  const trackingId = import.meta.env.VITE_GA_TRACKING_ID as string | undefined;
  
  const trackPageView = useCallback((path: string) => {
    if (!trackingId || !window.gtag) return;
    
    window.gtag('config', trackingId, {
      page_path: path,
    });
  }, [trackingId]);
  
  const trackEvent = useCallback((
    action: string, 
    category: string, 
    label?: string, 
    value?: number
  ) => {
    if (!trackingId || !window.gtag) return;
    
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }, [trackingId]);
  
  return { 
    trackPageView, 
    trackEvent, 
    isEnabled: !!trackingId 
  };
}
