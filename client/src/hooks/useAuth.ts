import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getAccessToken } from "@/lib/supabase";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const token = await getAccessToken();
      
      if (!token) {
        return null;
      }
      
      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error('Failed to fetch user');
      }
      
      return response.json();
    },
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
