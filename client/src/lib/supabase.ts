import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let initPromise: Promise<void> | null = null;

async function initSupabase() {
  if (supabaseInstance) return;
  
  try {
    const response = await fetch('/api/config');
    const { supabaseUrl, supabaseAnonKey } = await response.json();
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables from server');
      throw new Error('Supabase not configured');
    }
    
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'simpli-docs-auth',
      }
    });
    
    console.log('✅ Supabase client initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Supabase:', error);
    throw error;
  }
}

export async function getSupabase(): Promise<SupabaseClient> {
  if (!supabaseInstance) {
    if (!initPromise) {
      initPromise = initSupabase();
    }
    await initPromise;
  }
  return supabaseInstance!;
}

export async function getCurrentUser() {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

export async function getAccessToken() {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}
