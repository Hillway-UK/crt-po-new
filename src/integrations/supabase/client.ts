import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://zwrxmjsaxehodqsnbluc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cnhtanNheGVob2Rxc25ibHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTU0MTUsImV4cCI6MjA4MTQ3MTQxNX0.ModXVQ8PLcG4l_pApl4xk18OalRkv-a_Z5oic7A1JcU";

export const isSupabaseConfigured = true;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
