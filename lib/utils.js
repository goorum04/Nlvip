import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Returns the base URL for API calls.
 * On mobile/Capacitor, it must point to the production server.
 * On web/Development, it can be an empty string for relative paths.
 */
export function getApiUrl() {
  if (typeof window === 'undefined') return '';
  
  // Capacitor protocol is often 'capacitor:' or 'http://localhost' on iOS
  // Running from local files also uses 'file:'
  const isNative = 
    window.location.protocol === 'capacitor:' || 
    window.location.protocol === 'file:' ||
    window.location.hostname === 'localhost' && window.location.port !== '3000'; // Mobile livereload or similar
    
  return isNative ? 'https://nlvip.vercel.app' : '';
}
