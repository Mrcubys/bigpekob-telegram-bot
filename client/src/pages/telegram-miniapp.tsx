import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type VideoResponse } from "@shared/schema";
import { Heart, MessageCircle, VolumeX, Volume2, Play, Pause, User } from "lucide-react";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
        };
        themeParams: Record<string, string>;
        colorScheme: "light" | "dark";
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
        };
        MainButton: {
          show: () => void;
          hide: () => void;
          setText: (text: string) => void;
          onClick: (cb: () => void) => void;
        };
      };
    };
  }
}

function TelegramVideoCard({ video, isActive }: { video: VideoResponse; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [localLiked, setLocalLiked] = useState(video.isLiked ?? false);
  const [localLikeCount, setLocalLikeCount] = useState(video.likeCount ?? 0);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const toggleLike = async () => {
    try {
      const res = await fetch(`/api/videos/${video.id}/like`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setLocalLiked(data.liked);
        setLocalLikeCount(data.likeCount);
      }
    } catch {}
  };

  const src = video.fileUrl?.startsWith("/uploads/")
    ? video.fileUrl
    : `/api/videos/${video.id}/stream`;

  return (
    <div className="relative w-full h-full bg-black flex-shrink-0 snap-start">
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        onClick={togglePlay}
        preload="auto"
        data-testid={`tg-video-${video.id}`}
      />

      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

      <div className="absolute bottom-0 left-0 right-16 p-4 pb-6">
        <div className="flex items-center gap-2 mb-2">
          {video.author?.avatarData ? (
            <img
              src={`data:image/jpeg;base64,${video.author.avatarData}`}
              alt=""
              className="w-8 h-8 rounded-full object-cover border border-white/30"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center border border-white/30">
              <User className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="text-white font-semibold text-sm">
            {video.author?.displayName || `@${video.author?.username}`}
          </span>
        </div>
        <p className="text-white text-sm font-medium line-clamp-2">{video.title}</p>
        {video.description && (
          <p className="text-white/70 text-xs mt-1 line-clamp-1">{video.description}</p>
        )}
      </div>

      <div className="absolute right-3 bottom-6 flex flex-col items-center gap-5">
        <button
          onClick={toggleLike}
          className="flex flex-col items-center gap-1"
          data-testid={`tg-like-btn-${video.id}`}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${localLiked ? "bg-red-500/20" : "bg-black/30"}`}>
            <Heart
              className={`w-6 h-6 ${localLiked ? "fill-red-500 text-red-500" : "text-white"}`}
            />
          </div>
          <span className="text-white text-xs font-semibold">{localLikeCount}</span>
        </button>

        <button
          onClick={() => setIsMuted(!isMuted)}
          className="flex flex-col items-center gap-1"
          data-testid={`tg-mute-btn-${video.id}`}
        >
          <div className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center">
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-white" />
            ) : (
              <Volume2 className="w-5 h-5 text-white" />
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

export default function TelegramMiniApp() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  const { data: videos = [], isLoading } = useQuery<VideoResponse[]>({
    queryKey: ["/api/videos"],
    queryFn: async () => {
      const res = await fetch("/api/videos", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const index = Math.round(container.scrollTop / container.clientHeight);
      setActiveIndex(index);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-white/70">Loading BigPekob...</p>
        </div>
      </div>
    );
  }

  if (!videos.length) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white px-6">
          <p className="text-xl font-bold mb-2">Belum ada video</p>
          <p className="text-white/60 text-sm">Belum ada video yang tersedia</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative">
      {tgUser && (
        <div className="absolute top-0 left-0 right-0 z-50 px-4 py-3 bg-gradient-to-b from-black/70 to-transparent flex items-center gap-2">
          {tgUser.photo_url ? (
            <img src={tgUser.photo_url} alt="" className="w-7 h-7 rounded-full" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="text-white text-sm font-medium">
            {tgUser.first_name}{tgUser.last_name ? ` ${tgUser.last_name}` : ""}
          </span>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollbarWidth: "none" }}
      >
        {videos.map((video, i) => (
          <div key={video.id} className="w-full h-full flex-shrink-0 snap-start">
            <TelegramVideoCard video={video} isActive={i === activeIndex} />
          </div>
        ))}
      </div>
    </div>
  );
}
