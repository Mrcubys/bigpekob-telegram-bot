import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type VideoResponse } from "@shared/schema";

export function useVideos() {
  return useQuery<VideoResponse[]>({
    queryKey: [api.videos.list.path],
    queryFn: async () => {
      const res = await fetch(api.videos.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch videos");
      return await res.json();
    },
  });
}

export function useUploadVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, title, description }: { file: File; title: string; description?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      if (description) {
        formData.append("description", description);
      }

      // Do NOT set Content-Type header manually here. 
      // The browser needs to set it to 'multipart/form-data' with the correct boundary automatically.
      const res = await fetch(api.videos.upload.path, {
        method: api.videos.upload.method,
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = "Failed to upload video";
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed.message || errorMessage;
        } catch (e) {
          // keep default error message
        }
        throw new Error(errorMessage);
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.videos.list.path] });
    },
  });
}
