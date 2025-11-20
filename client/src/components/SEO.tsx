import { useEffect } from 'react';
import { useI18n, type Language } from '@/lib/i18n';

interface SEOProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  structuredData?: Record<string, any>;
}

const languageToLocale: Record<Language, string> = {
  en: 'en_US',
  es: 'es_ES',
  da: 'da_DK',
  sv: 'sv_SE',
  ru: 'ru_RU',
};

function setMetaTag(name: string, content: string, isProperty: boolean = false) {
  const attribute = isProperty ? 'property' : 'name';
  let element = document.querySelector(`meta[${attribute}="${name}"]`);
  
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  
  element.setAttribute('content', content);
}

function setLinkTag(rel: string, href: string) {
  let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
  
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  
  element.setAttribute('href', href);
}

export function SEO({ 
  title, 
  description, 
  image, 
  url, 
  type = 'website',
  structuredData 
}: SEOProps) {
  const { language } = useI18n();
  const locale = languageToLocale[language];
  
  // Default values
  const siteName = 'Marbella Golf Times';
  const defaultImage = image || 'https://marbellagolftimes.com/favicon.png';
  const defaultUrl = url || 'https://marbellagolftimes.com';
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
  
  useEffect(() => {
    // Set document title
    document.title = fullTitle;
    
    // Basic meta tags
    setMetaTag('description', description);
    
    // OpenGraph tags
    setMetaTag('og:title', fullTitle, true);
    setMetaTag('og:description', description, true);
    setMetaTag('og:image', defaultImage, true);
    setMetaTag('og:url', defaultUrl, true);
    setMetaTag('og:type', type, true);
    setMetaTag('og:site_name', siteName, true);
    setMetaTag('og:locale', locale, true);
    
    // Twitter Card tags
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', fullTitle);
    setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', defaultImage);
    
    // Canonical URL
    setLinkTag('canonical', defaultUrl);
    
    // Remove old JSON-LD scripts first to prevent stale data
    const oldScripts = document.querySelectorAll('script[type="application/ld+json"]');
    oldScripts.forEach(script => script.remove());
    
    // Add new JSON-LD only if provided
    if (structuredData) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
    
    // Cleanup on unmount
    return () => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      scripts.forEach(script => script.remove());
    };
  }, [title, description, image, url, type, locale, structuredData, fullTitle, defaultImage, defaultUrl]);
  
  return null;
}
