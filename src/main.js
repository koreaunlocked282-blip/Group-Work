import { supabase, supabaseConfigured } from './lib/supabase.js'

// Read by the prototype's inline script. Only public values: URL/anon key live inside the client; the
// Turnstile SITE key is public by design. No secret of any kind is exposed here.
window.KU = Object.freeze({
  supabase,
  supabaseConfigured,
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY || '',
})
