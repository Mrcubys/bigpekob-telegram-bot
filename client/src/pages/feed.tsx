import { useVideos } from "@/hooks/use-videos";
import { VideoPlayer } from "@/components/video/video-player";
import { Loader2, MonitorPlay } from "lucide-react";

// Optional simple top nav for "Following | For You"
function FeedTopNav() {
  return (
    <div className="absolute top-0 left-0 right-0 h-[60px] bg-gradient-to-b from-black/60 to-transparent flex items-center justify-center z-50">
      <div className="flex items-center gap-4 text-white font-semibold text-[15px] text-shadow">
        <span className="opacity-70 cursor-pointer">Following</span>
        <span className="opacity-40">|</span>
        <span className="relative cursor-pointer">
          For You
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-1 bg-white rounded-full"></span>
        </span>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const { data: videos, isLoading, error } = useVideos();

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-zinc-400 font-medium">Loading BigPekob...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-white px-6 text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
          <MonitorPlay className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold mb-2">Feed unavailable</h2>
        <p className="text-zinc-400 text-sm">Failed to load videos. Check your connection and try again.</p>
      </div>
    );
  }

  if (!videos || videos.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-white px-6 text-center">
        <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
          <MonitorPlay className="w-10 h-10 text-zinc-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No videos yet</h2>
        <p className="text-zinc-400 text-sm mb-8 max-w-[250px]">Be the first to create and share a moment on BigPekob.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black relative">
      <FeedTopNav />
      {/* Scroll container */}
      <div className="w-full h-[100dvh] overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black">
        {videos.map((video) => (
          <VideoPlayer key={video.id} video={video} isActive={false} />
        ))}
      </div>
    </div>
  );
}
