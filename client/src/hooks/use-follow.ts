import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/users/${userId}/follow`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to toggle follow");
      }
      return res.json() as Promise<{ following: boolean }>;
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/search/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });
}
