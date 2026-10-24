/**
 * BRUTAL — API configuration
 * 
 * The frontend talks to the Hono server, which talks to Supabase.
 * The frontend does NOT talk to Supabase directly.
 * 
 * API_BASE is empty string because the server serves both the API 
 * and the static files from the same origin. So fetch("/health") 
 * goes to the same Railway URL that served the HTML.
 */

// Legacy exports kept temporarily so older imports do not fail. The frontend
// no longer needs Supabase credentials because every request uses this server.
export const projectId = ""
export const publicAnonKey = ""

// This is what all API calls should use
// Empty string = same origin = relative URLs
// fetch(`${API_BASE}/health`) → fetch("/health")
export const API_BASE = ""
