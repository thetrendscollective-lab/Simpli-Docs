import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service role (for admin operations)
let supabase: any = null;

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  console.log("✅ Supabase Admin client initialized");
} else {
  console.warn("⚠️  Supabase environment variables not found. Authentication will not work.");
}

export { supabase };

// Add a new user
export async function addUser(email: string) {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }
  
  const { data, error } = await supabase
    .from("simplydocs_users")
    .insert([{ email }]);

  if (error) {
    console.error("Error adding user:", error);
    throw error;
  }
  return data;
}

// Deduct free trial pages
export async function usePages(userId: string, pages: number) {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const { data: user } = await supabase
    .from("simplydocs_users")
    .select("free_pages_remaining")
    .eq("id", userId)
    .single();

  if (!user) throw new Error("User not found");

  if (user.free_pages_remaining < pages) {
    throw new Error("Free trial used up. Please upgrade.");
  }

  await supabase
    .from("simplydocs_users")
    .update({
      free_pages_remaining: user.free_pages_remaining - pages,
    })
    .eq("id", userId);

  return { remaining: user.free_pages_remaining - pages };
}