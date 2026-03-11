import { useRef, useState, useEffect, useCallback } from "react";
import { useInView } from "react-intersection-observer";
import { Heart, MessageCircle, Share2, Disc, VolumeX, Volume2, User, Plus, X, Send, ChevronDown } from "lucide-react";
import { type VideoResponse } from "@shared/schema";
import { clsx } from "clsx";
import { useLikeVideo } from "@/hooks/use-videos";
import { useComments, useAddComment } from "@/hooks/use-comments";
import { useFollow } from "@/hooks/use-follow";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

interface VideoPlayerProps {
  video: VideoResponse;
  isActive: boolean;
}

export function VideoPlayer({ video, isActive }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [localLiked, setLocalLiked] = useState(video.isLiked ?? false);
  const [localLikeCount, setLocalLikeCount] = useState(video.likeCount ?? 0);

  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { ref: containerRef, inView } = useInView({ threshold: 0.6 });

  const likeMutation = useLikeVideo();
  const followMutation = useFollow();
  const { data: comments = [] } = useComments(showComments ? video.id : undefined);
  const addCommentMutation = useAddComment(video.id);

  // Sync local state when video prop changes
  useEffect(() => {
    setLocalLiked(video.isLiked ?? false);
    setLocalLikeCount(video.likeCount ?? 0);
  }, [video.id, video.isLiked, video.likeCount]);

  // Play/pause based on visibility
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (inView && isActive) {
      if (el.paused) {
        el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    } else {
      if (!el.paused) el.pause();
      setIsPlaying(false);
      el.currentTime = 0;
    }
  }, [inView, isActive]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [isPlaying]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { setLocation("/auth"); return; }
    const wasLiked = localLiked;
    setLocalLiked(!wasLiked);
    setLocalLikeCount((c) => wasLiked ? c - 1 : c + 1);
    likeMutation.mutate(video.id, {
      onError: () => {
        setLocalLiked(wasLiked);
        setLocalLikeCount((c) => wasLiked ? c + 1 : c - 1);
      },
    });
  };

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { setLocation("/auth"); return; }
    if (video.author) {
      followMutation.mutate(video.author.id);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?v=${video.id}`;
    if (navigator.share) {
      navigator.share({ title: video.title, text: video.description || "", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        alert("Link copied to clipboard!");
      }).catch(() => {});
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setLocation("/auth"); return; }
    if (!commentInput.trim()) return;
    await addCommentMutation.mutateAsync(commentInput.trim());
    setCommentInput("");
  };

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (video.author) setLocation(`/profile/${video.author.id}`);
  };

  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  const videoSrc = video.fileUrl
    ? (video.fileUrl.startsWith("/") ? video.fileUrl : `/${video.fileUrl}`)
    : `/api/videos/${video.id}/stream`;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[100dvh] snap-start bg-black flex items-center justify-center overflow-hidden"
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        className="w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        data-testid={`video-player-${video.id}`}
      />

      {/* Play indicator */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center">
            <div className="w-0 h-0 border-t-8 border-t-transparent border-l-[14px] border-l-white border-b-8 border-b-transparent ml-1" />
          </div>
        </div>
      )}

      {/* Mute Toggle */}
      <button
        onClick={toggleMute}
        className="absolute top-6 right-4 w-10 h-10 bg-black/20 backdrop-blur flex items-center justify-center rounded-full z-20 hover:bg-black/40 transition"
        data-testid="button-mute"
      >
        {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
      </button>

      {/* Gradient Overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none z-0" />

      {/* Content Overlay */}
      <div className="absolute bottom-[70px] left-4 right-[70px] z-10 text-white flex flex-col gap-2">
        <button
          onClick={handleAvatarClick}
          className="font-semibold text-[17px] text-left hover:opacity-80 transition"
          data-testid={`link-author-${video.id}`}
        >
          @{video.author?.displayName || video.author?.username || "unknown"}
        </button>
        <p className="text-[15px] leading-snug font-medium opacity-90 line-clamp-3">
          {video.title}{video.description ? ` — ${video.description}` : ""}
        </p>
        <div className="flex items-center gap-2 mt-1 bg-black/30 backdrop-blur px-3 py-1.5 rounded-full w-max text-sm">
          <Disc className="w-4 h-4 animate-spin" style={{ animationDuration: "3s" }} />
          <span>Original Audio · {video.author?.username || "creator"}</span>
        </div>
      </div>

      {/* Right Action Bar */}
      <div className="absolute bottom-[80px] right-2 flex flex-col items-center gap-5 z-10">
        {/* Avatar + Follow */}
        <div className="relative cursor-pointer" onClick={handleAvatarClick}>
          <div className="w-12 h-12 bg-white rounded-full p-0.5">
            <div className="w-full h-full bg-zinc-800 rounded-full flex items-center justify-center overflow-hidden">
              {video.author?.avatarData ? (
                <img src={video.author.avatarData} alt="" className="w-full h-full object-cover rounded-full" />
              ) : (
                <User className="w-6 h-6 text-zinc-400" />
              )}
            </div>
          </div>
          <button
            onClick={handleFollow}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-black"
            data-testid={`button-follow-${video.author?.id}`}
          >
            <Plus className="w-3 h-3 text-white" strokeWidth={3} />
          </button>
        </div>

        {/* Like */}
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform mt-4"
          data-testid={`button-like-${video.id}`}
        >
          <Heart
            className={clsx("w-8 h-8 transition-all duration-200", localLiked ? "fill-primary text-primary scale-110" : "text-white")}
            strokeWidth={localLiked ? 0 : 2}
          />
          <span className="text-white text-xs font-semibold">{formatCount(localLikeCount)}</span>
        </button>

        {/* Comments */}
        <button
          onClick={(e) => { e.stopPropagation(); if (!user) { setLocation("/auth"); return; } setShowComments(true); }}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          data-testid={`button-comment-${video.id}`}
        >
          <MessageCircle className="w-8 h-8 text-white fill-white/20" strokeWidth={2} />
          <span className="text-white text-xs font-semibold">{formatCount(video.commentCount ?? 0)}</span>
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          data-testid={`button-share-${video.id}`}
        >
          <Share2 className="w-8 h-8 text-white fill-white/20" strokeWidth={2} />
          <span className="text-white text-xs font-semibold">Share</span>
        </button>
      </div>

      {/* Comments Sheet */}
      {showComments && (
        <div
          className="absolute inset-0 z-40 flex flex-col justify-end"
          onClick={(e) => { e.stopPropagation(); }}
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowComments(false)} />
          <div className="relative bg-zinc-900 rounded-t-2xl h-[70%] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <span className="text-white font-semibold">{formatCount(video.commentCount ?? 0)} Comments</span>
              <button onClick={() => setShowComments(false)} className="text-zinc-400 hover:text-white transition" data-testid="button-close-comments">
                <ChevronDown className="w-6 h-6" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
                  <MessageCircle className="w-10 h-10" />
                  <p className="text-sm">No comments yet. Be the first!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3" data-testid={`comment-${comment.id}`}>
                    <div className="w-8 h-8 bg-zinc-700 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {comment.author?.avatarData ? (
                        <img src={comment.author.avatarData} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-400">
                        @{comment.author?.displayName || comment.author?.username || "user"}
                      </p>
                      <p className="text-white text-sm mt-0.5">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input */}
            <form onSubmit={handleCommentSubmit} className="flex items-center gap-3 p-3 border-t border-zinc-800 bg-zinc-900">
              <div className="w-8 h-8 bg-zinc-700 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                {user?.avatarData ? (
                  <img src={user.avatarData} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-zinc-400" />
                )}
              </div>
              <input
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-zinc-800 rounded-full px-4 py-2 text-white text-sm focus:outline-none"
                data-testid="input-comment"
              />
              <button
                type="submit"
                disabled={!commentInput.trim() || addCommentMutation.isPending}
                className="text-primary disabled:opacity-40 transition"
                data-testid="button-submit-comment"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
