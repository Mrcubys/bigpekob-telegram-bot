import { useQuery } from "@tanstack/react-query";
import { type UserPublic } from "@shared/schema";

export function useSearchUsers(query: string) {
  return useQuery<UserPublic[]>({
    queryKey: ["/api/search/users", query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const res = await fetch(`/api/search/users?q=${encodeURIComponent(query)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: query.trim().length > 0,
  });
}
