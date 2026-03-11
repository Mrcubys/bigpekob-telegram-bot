import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type CommentResponse } from "@shared/schema";

export function useComments(videoId: number | undefined) {
  return useQuery<CommentResponse[]>({
    queryKey: ["/api/videos", videoId, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/videos/${videoId}/comments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
    enabled: !!videoId,
  });
}

export function useAddComment(videoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to add comment");
      }
      return res.json() as Promise<CommentResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos", videoId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    },
  });
}
