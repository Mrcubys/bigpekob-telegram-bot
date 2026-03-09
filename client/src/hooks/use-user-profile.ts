import { useQuery } from "@tanstack/react-query";
import { type UserPublic } from "@shared/schema";

export function useUserProfile(userId: number | undefined) {
  return useQuery<UserPublic>({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!userId,
  });
}
