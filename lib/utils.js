import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"
import { supabase } from "@/lib/supabase"

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

  return isNative ? 'https://app.nlvipnutrition.com' : '';
}

/**
 * Fetch wrapper that attaches the current Supabase session's access token.
 * Use for API routes that require authentication.
 */
export async function authFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = {
    ...(options.headers || {}),
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  }
  return fetch(getApiUrl() + path, { ...options, headers })
}
