import { useRef, useState, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { Heart, MessageCircle, Bookmark, Share2, Disc, VolumeX, Volume2, User, Plus } from "lucide-react";
import { type VideoResponse } from "@shared/schema";
import { clsx } from "clsx";

interface VideoPlayerProps {
  video: VideoResponse;
  isActive: boolean;
}

export function VideoPlayer({ video, isActive }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  
  const { ref: containerRef, inView } = useInView({
    threshold: 0.6, // Trigger when 60% of video is visible
  });

  // Handle Play/Pause based on scroll visibility
  useEffect(() => {
    if (!videoRef.current) return;
    
    if (inView) {
      // Check current state before trying to play
      if (videoRef.current.paused) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch(() => {
              setIsPlaying(false);
            });
        } else {
          setIsPlaying(true);
        }
      }
    } else {
      // Check if currently playing before pausing
      if (!videoRef.current.paused) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
      // Reset video to start when scrolled out of view for loop feel
      videoRef.current.currentTime = 0;
    }
  }, [inView]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
          });
      } else {
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-[100dvh] snap-start bg-black flex items-center justify-center overflow-hidden"
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={video.fileUrl}
        className="w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
      />
      
      {/* Play indicator pulse (shows briefly when paused) */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none transition-opacity">
           <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center">
             <div className="w-0 h-0 border-t-8 border-t-transparent border-l-[14px] border-l-white border-b-8 border-b-transparent ml-1" />
           </div>
        </div>
      )}

      {/* Mute Toggle */}
      <button 
        onClick={toggleMute}
        className="absolute top-6 right-4 w-10 h-10 bg-black/20 backdrop-blur flex items-center justify-center rounded-full z-20 hover:bg-black/40 transition"
      >
        {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
      </button>

      {/* Gradient Overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 video-overlay-gradient pointer-events-none z-0" />

      {/* Content Overlay */}
      <div className="absolute bottom-[70px] left-4 right-[70px] z-10 text-white flex flex-col gap-2">
        <h3 className="font-semibold text-[17px] text-shadow flex items-center gap-2">
          @{video.author?.username || "unknown_user"}
        </h3>
        <p className="text-[15px] leading-snug font-medium text-shadow opacity-90 line-clamp-3">
          {video.title} {video.description && `— ${video.description}`}
        </p>
        <div className="flex items-center gap-2 mt-2 bg-black/30 backdrop-blur px-3 py-1.5 rounded-full w-max text-sm">
          <Disc className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
          <span>Original Audio - {video.author?.username || "creator"}</span>
        </div>
      </div>

      {/* Right Action Bar */}
      <div className="absolute bottom-[80px] right-2 flex flex-col items-center gap-5 z-10">
        <div className="relative group cursor-pointer active:scale-90 transition-transform">
          <div className="w-12 h-12 bg-white rounded-full p-0.5">
            <div className="w-full h-full bg-zinc-800 rounded-full flex items-center justify-center overflow-hidden">
               <User className="w-6 h-6 text-zinc-400" />
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
            <Plus className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        </div>

        <button 
          onClick={(e) => { e.stopPropagation(); setIsLiked(!isLiked); }}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform mt-4"
        >
          <div className="w-10 h-10 flex items-center justify-center">
            <Heart className={clsx("w-8 h-8 transition-colors", isLiked ? "fill-primary text-primary" : "text-white")} strokeWidth={isLiked ? 0 : 2} />
          </div>
          <span className="text-white text-xs font-semibold text-shadow">
            {isLiked ? '8.4K' : '8.3K'}
          </span>
        </button>

        <button className="flex flex-col items-center gap-1 group active:scale-90 transition-transform">
          <div className="w-10 h-10 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-white fill-white/20" strokeWidth={2} />
          </div>
          <span className="text-white text-xs font-semibold text-shadow">402</span>
        </button>

        <button className="flex flex-col items-center gap-1 group active:scale-90 transition-transform">
          <div className="w-10 h-10 flex items-center justify-center">
            <Bookmark className="w-8 h-8 text-white fill-white/20" strokeWidth={2} />
          </div>
          <span className="text-white text-xs font-semibold text-shadow">122</span>
        </button>

        <button className="flex flex-col items-center gap-1 group active:scale-90 transition-transform">
          <div className="w-10 h-10 flex items-center justify-center">
            <Share2 className="w-8 h-8 text-white fill-white/20" strokeWidth={2} />
          </div>
          <span className="text-white text-xs font-semibold text-shadow">Share</span>
        </button>
      </div>
    </div>
  );
}
