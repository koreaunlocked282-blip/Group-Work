import { createClient } from '@supabase/supabase-js'

// Public values only. The anon key is safe in the browser because RLS protects the data.
// Never use a VITE_ variable for the service role key or any other secret.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabaseConfigured = Boolean(url && key)

// "Remember me" unchecked -> session kept in sessionStorage (ends with the tab); checked -> localStorage
export const store = {
  getItem: (k) => sessionStorage.getItem(k) ?? localStorage.getItem(k),
  setItem: (k, v) => {
    const keepAcrossSessions = localStorage.getItem('ku_remember') !== '0'
    ;(keepAcrossSessions ? localStorage : sessionStorage).setItem(k, v)
    ;(keepAcrossSessions ? sessionStorage : localStorage).removeItem(k)
  },
  removeItem: (k) => { sessionStorage.removeItem(k); localStorage.removeItem(k) },
}

// Stays null when unconfigured so the prototype still renders (its buttons keep saying "Integration required").
export const supabase = supabaseConfigured
  ? createClient(url, key, { auth: { storage: store, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })
  : null
