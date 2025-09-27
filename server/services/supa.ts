import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Add a new user
export async function addUser(email: string) {
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