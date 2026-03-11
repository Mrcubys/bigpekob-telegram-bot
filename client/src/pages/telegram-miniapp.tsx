import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type VideoResponse, type User } from "@shared/schema";
import {
  Heart, MessageCircle, VolumeX, Volume2, Play,
  User as UserIcon, Upload, Home, X, Send,
  Loader2, Camera, LogOut, PlaySquare, ChevronDown,
  KeyRound, Download, Star
} from "lucide-react";
import { clsx } from "clsx";

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
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
        };
      };
    };
  }
}

type Tab = "feed" | "upload" | "profile";

// ─── Comment Sheet ──────────────────────────────────────────────────────────
function CommentSheet({
  videoId,
  onClose,
  user,
  onNeedLogin,
}: {
  videoId: number;
  onClose: () => void;
  user: User | null | undefined;
  onNeedLogin: () => void;
}) {
  const [text, setText] = useState("");
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/videos", videoId, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/videos/${videoId}/comments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos", videoId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setText("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { onNeedLogin(); return; }
    if (!text.trim()) return;
    addMutation.mutate(text.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-t-2xl flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-white font-semibold text-sm">Komentar ({comments.length})</span>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: "none" }}>
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
          ) : comments.length === 0 ? (
            <p className="text-zinc-500 text-center text-sm py-6">Belum ada komentar</p>
          ) : comments.map((c: any) => (
            <div key={c.id} className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                {c.author?.avatarData ? (
                  <img src={c.author.avatarData} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </div>
              <div>
                <span className="text-white text-xs font-semibold">
                  {c.author?.displayName || `@${c.author?.username}`}
                </span>
                <p className="text-zinc-300 text-sm mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 border-t border-zinc-800">
          <input
            className="flex-1 bg-zinc-800 text-white text-sm rounded-full px-4 py-2 outline-none placeholder-zinc-500"
            placeholder={user ? "Tulis komentar..." : "Login dulu untuk komentar"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => { if (!user) onNeedLogin(); }}
          />
          <button
            type="submit"
            disabled={!text.trim() || addMutation.isPending}
            className="w-9 h-9 bg-primary rounded-full flex items-center justify-center disabled:opacity-40"
          >
            {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Video Card ──────────────────────────────────────────────────────────────
function TGVideoCard({
  video,
  isActive,
  user,
  onNeedLogin,
  isVip,
  telegramId,
}: {
  video: VideoResponse;
  isActive: boolean;
  user: User | null | undefined;
  onNeedLogin: () => void;
  isVip?: boolean;
  telegramId?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [localLiked, setLocalLiked] = useState(video.isLiked ?? false);
  const [localLikeCount, setLocalLikeCount] = useState(video.likeCount ?? 0);
  const [localCommentCount, setLocalCommentCount] = useState(video.commentCount ?? 0);
  const [showComments, setShowComments] = useState(false);
  const playAttemptRef = useRef(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      const attempt = ++playAttemptRef.current;
      el.currentTime = 0;
      const p = el.play();
      if (p) p.then(() => { if (playAttemptRef.current === attempt) setIsPlaying(true); }).catch(() => {});
    } else {
      playAttemptRef.current++;
      el.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => { setIsBuffering(false); setIsPlaying(true); };
    const onPause = () => setIsPlaying(false);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("pause", onPause);
    return () => { el.removeEventListener("waiting", onWaiting); el.removeEventListener("playing", onPlaying); el.removeEventListener("pause", onPause); };
  }, []);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      const attempt = ++playAttemptRef.current;
      el.play().then(() => { if (playAttemptRef.current === attempt) setIsPlaying(true); }).catch(() => {});
    } else {
      playAttemptRef.current++;
      el.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleLike = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (!user) { onNeedLogin(); return; }
    const wasLiked = localLiked;
    setLocalLiked(!wasLiked);
    setLocalLikeCount((c) => wasLiked ? c - 1 : c + 1);
    fetch(`/api/videos/${video.id}/like`, { method: "POST", credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setLocalLiked(d.liked);
        setLocalLikeCount(d.likeCount);
        queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      })
      .catch(() => {
        setLocalLiked(wasLiked);
        setLocalLikeCount((c) => wasLiked ? c + 1 : c - 1);
      });
  };

  const handleComment = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setShowComments(true);
  };

  const src = video.fileUrl?.startsWith("/uploads/")
    ? video.fileUrl
    : `/api/videos/${video.id}/stream`;

  const formatCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <div className="relative w-full h-full bg-black snap-start">
      <video
        ref={videoRef}
        src={isActive ? src : undefined}
        poster={isActive ? undefined : ""}
        className="w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        preload="auto"
        data-testid={`tg-video-${video.id}`}
      />

      <div
        className="absolute inset-0 z-10"
        onClick={togglePlay}
        onTouchEnd={(e) => { e.preventDefault(); togglePlay(); }}
        data-testid={`tg-video-tap-${video.id}`}
      />

      {(!isPlaying || isBuffering) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          {isBuffering ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          ) : (
            <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center">
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </div>
          )}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

      {/* Info bawah kiri */}
      <div className="absolute bottom-[70px] left-0 right-[70px] px-4 z-20 pointer-events-none">
        <div className="flex items-center gap-2 mb-1.5">
          {video.author?.avatarData ? (
            <img src={`data:image/jpeg;base64,${video.author.avatarData}`} alt="" className="w-8 h-8 rounded-full object-cover border border-white/30" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="text-white font-semibold text-sm drop-shadow">
            {video.author?.displayName || `@${video.author?.username}`}
          </span>
        </div>
        <p className="text-white text-sm font-medium line-clamp-2 drop-shadow">{video.title}</p>
        {video.description && (
          <p className="text-white/70 text-xs mt-0.5 line-clamp-1">{video.description}</p>
        )}
      </div>

      {/* Tombol kanan */}
      <div className="absolute right-3 bottom-[75px] flex flex-col items-center gap-5 z-30">
        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center gap-1" data-testid={`tg-like-btn-${video.id}`}>
          <div className={clsx("w-11 h-11 rounded-full flex items-center justify-center", localLiked ? "bg-red-500/20" : "bg-black/40")}>
            <Heart className={clsx("w-6 h-6", localLiked ? "fill-red-500 text-red-500" : "text-white")} />
          </div>
          <span className="text-white text-[11px] font-semibold drop-shadow">{formatCount(localLikeCount)}</span>
        </button>

        {/* Komentar */}
        <button onClick={handleComment} className="flex flex-col items-center gap-1" data-testid={`tg-comment-btn-${video.id}`}>
          <div className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-[11px] font-semibold drop-shadow">{formatCount(localCommentCount)}</span>
        </button>

        {/* Mute */}
        <button
          onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
          className="flex flex-col items-center gap-1"
          data-testid={`tg-mute-btn-${video.id}`}
        >
          <div className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center">
            {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
          </div>
        </button>

        {/* Download (VIP only) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isVip) {
              alert("🌟 Fitur ini khusus VIP!\n\nUpgrade VIP lewat bot Telegram untuk bisa download video.");
              return;
            }
            if (!telegramId) {
              alert("Login via Telegram untuk download.");
              return;
            }
            const a = document.createElement("a");
            a.href = `/api/videos/${video.id}/download?telegram_id=${telegramId}`;
            a.download = video.title || "video";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
          className="flex flex-col items-center gap-1"
          data-testid={`tg-download-btn-${video.id}`}
        >
          <div className={clsx("w-11 h-11 rounded-full flex items-center justify-center", isVip ? "bg-yellow-500/30" : "bg-black/40")}>
            {isVip ? <Download className="w-5 h-5 text-yellow-400" /> : <Star className="w-5 h-5 text-zinc-400" />}
          </div>
          <span className="text-white/60 text-[9px]">{isVip ? "Unduh" : "VIP"}</span>
        </button>
      </div>

      {showComments && (
        <CommentSheet
          videoId={video.id}
          onClose={() => { setShowComments(false); setLocalCommentCount((c) => c); }}
          user={user}
          onNeedLogin={onNeedLogin}
        />
      )}
    </div>
  );
}

// ─── Feed Tab ────────────────────────────────────────────────────────────────
function FeedTab({ user, onNeedLogin, isVip, telegramId }: { user: User | null | undefined; onNeedLogin: () => void; isVip?: boolean; telegramId?: number }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: videos = [], isLoading } = useQuery<VideoResponse[]>({
    queryKey: ["/api/videos"],
    queryFn: async () => {
      const res = await fetch("/api/videos", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const index = Math.round(container.scrollTop / container.clientHeight);
        setActiveIndex(index);
        ticking = false;
      });
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-white/60">Memuat video...</p>
        </div>
      </div>
    );
  }

  if (!videos.length) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-center px-6">
        <div>
          <PlaySquare className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-white font-bold text-xl mb-1">Belum ada video</p>
          <p className="text-zinc-400 text-sm">Jadilah yang pertama upload!</p>
        </div>
      </div>
    );
  }

  const RENDER_WINDOW = 2;

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-scroll snap-y snap-mandatory"
      style={{ scrollbarWidth: "none" }}
    >
      {videos.map((video, i) => {
        const nearActive = Math.abs(i - activeIndex) <= RENDER_WINDOW;
        return (
          <div key={video.id} className="w-full h-full flex-shrink-0">
            {nearActive ? (
              <TGVideoCard video={video} isActive={i === activeIndex} user={user} onNeedLogin={onNeedLogin} isVip={isVip} telegramId={telegramId} />
            ) : (
              <div className="w-full h-full bg-black" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Upload Tab ──────────────────────────────────────────────────────────────
function UploadTab({ user, onNeedLogin }: { user: User | null | undefined; onNeedLogin: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) onNeedLogin();
  }, [user]);

  if (!user) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-950 px-6">
        <div className="text-center">
          <Upload className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-white font-bold mb-1">Login Dulu</p>
          <p className="text-zinc-400 text-sm">Kamu harus login untuk upload video</p>
          <button onClick={onNeedLogin} className="mt-4 px-5 py-2 bg-primary text-white rounded-full text-sm font-semibold">Login</button>
        </div>
      </div>
    );
  }

  const MAX_FILE_SIZE = 100 * 1024 * 1024;

  const handleUpload = async () => {
    if (!file || !title.trim()) return;

    if (file.size > MAX_FILE_SIZE) {
      setErr(`File terlalu besar (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimal 100 MB.`);
      return;
    }

    setUploading(true);
    setErr("");
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    if (desc.trim()) formData.append("description", desc.trim());

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/videos");
        xhr.withCredentials = true;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 95);
            setProgress(pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setProgress(100);
            resolve();
          } else {
            try {
              const data = JSON.parse(xhr.responseText);
              reject(new Error(data.message || `Error ${xhr.status}`));
            } catch {
              reject(new Error(`Error ${xhr.status}: Upload gagal`));
            }
          }
        };

        xhr.onerror = () => reject(new Error("Koneksi terputus. Cek internet kamu."));
        xhr.ontimeout = () => reject(new Error("Upload timeout. Coba file yang lebih kecil."));
        xhr.timeout = 5 * 60 * 1000;

        xhr.send(formData);
      });

      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setDone(true);
      setFile(null); setTitle(""); setDesc(""); setProgress(0);
    } catch (e: any) {
      setProgress(0);
      setErr(e.message || "Upload gagal. Pastikan kamu login dan coba lagi.");
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-950 px-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <PlaySquare className="w-8 h-8 text-green-400" />
          </div>
          <p className="text-white font-bold text-lg mb-1">Upload Berhasil!</p>
          <p className="text-zinc-400 text-sm mb-5">Video kamu sudah live di BigPekob</p>
          <button onClick={() => setDone(false)} className="px-5 py-2 bg-primary text-white rounded-full text-sm font-semibold">Upload Lagi</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-zinc-950 overflow-y-auto px-5 py-6" style={{ scrollbarWidth: "none" }}>
      <h2 className="text-white font-bold text-xl mb-6">Upload Video</h2>

      {/* File picker */}
      <label className="block mb-5 cursor-pointer">
        <div className={clsx(
          "w-full h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition",
          file ? "border-primary bg-primary/10" : "border-zinc-700 bg-zinc-900"
        )}>
          {file ? (
            <>
              <PlaySquare className="w-10 h-10 text-primary" />
              <p className="text-white text-sm font-medium px-4 text-center line-clamp-2">{file.name}</p>
              <p className={clsx("text-xs", file.size > 100 * 1024 * 1024 ? "text-red-400" : "text-zinc-400")}>{(file.size / 1024 / 1024).toFixed(1)} MB {file.size > 100 * 1024 * 1024 ? "(maks 100 MB)" : ""}</p>
            </>
          ) : (
            <>
              <Camera className="w-10 h-10 text-zinc-500" />
              <p className="text-zinc-300 text-sm font-medium">Pilih video dari galeri</p>
              <p className="text-zinc-600 text-xs">MP4, MOV, WebM</p>
            </>
          )}
        </div>
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          data-testid="tg-upload-file"
        />
      </label>

      <input
        className="w-full bg-zinc-900 text-white rounded-xl px-4 py-3 text-sm outline-none border border-zinc-800 focus:border-primary mb-3 placeholder-zinc-600"
        placeholder="Judul video *"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        data-testid="tg-upload-title"
      />

      <textarea
        className="w-full bg-zinc-900 text-white rounded-xl px-4 py-3 text-sm outline-none border border-zinc-800 focus:border-primary mb-5 placeholder-zinc-600 resize-none h-20"
        placeholder="Deskripsi (opsional)"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        data-testid="tg-upload-desc"
      />

      {err && <p className="text-red-400 text-sm mb-3">{err}</p>}

      {uploading && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>Mengupload...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || !title.trim() || uploading}
        className="w-full py-3.5 bg-primary text-white rounded-2xl font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        data-testid="tg-upload-btn"
      >
        {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengupload...</> : <><Upload className="w-4 h-4" /> Upload Sekarang</>}
      </button>
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────
function ProfileTab({ user, onNeedLogin, onLogout }: { user: User | null | undefined; onNeedLogin: () => void; onLogout: () => void }) {
  const [editMode, setEditMode] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const queryClient = useQueryClient();

  const { data: myVideos = [] } = useQuery<VideoResponse[]>({
    queryKey: ["/api/users", user?.id, "videos"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user!.id}/videos`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user?.id,
  });

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username || undefined, displayName: displayName || null, bio }),
      });
      if (!res.ok) throw new Error("Gagal");
      const updated = await res.json();
      queryClient.setQueryData(["/api/auth/me"], updated);
      setSaveMsg("Profil disimpan!");
      setEditMode(false);
    } catch {
      setSaveMsg("Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-950 px-6">
        <div className="text-center">
          <UserIcon className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-white font-bold mb-1">Belum Login</p>
          <p className="text-zinc-400 text-sm mb-5">Login untuk akses profil kamu</p>
          <button onClick={onNeedLogin} className="px-5 py-2 bg-primary text-white rounded-full text-sm font-semibold" data-testid="tg-profile-login-btn">Login / Daftar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-zinc-950 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      {/* Header */}
      <div className="bg-zinc-900 px-5 pt-8 pb-6">
        <div className="flex items-start gap-4 mb-4">
          {/* Avatar — klik untuk ganti foto */}
          <label className="relative cursor-pointer flex-shrink-0 group" data-testid="tg-avatar-label">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-zinc-700 overflow-hidden">
              {user.avatarData ? (
                <img src={user.avatarData} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-8 h-8 text-zinc-500" />
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-primary rounded-full flex items-center justify-center border border-zinc-900">
              <Camera className="w-3 h-3 text-white" />
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              data-testid="tg-avatar-input"
              onChange={async (e) => {
                const imgFile = e.target.files?.[0];
                if (!imgFile) return;
                const reader = new FileReader();
                reader.onload = async () => {
                  const base64 = reader.result as string;
                  try {
                    await fetch("/api/auth/profile", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ avatarData: base64 }),
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
                  } catch {}
                };
                reader.readAsDataURL(imgFile);
                e.target.value = "";
              }}
            />
          </label>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-lg leading-tight">{user.displayName || `@${user.username}`}</p>
            <p className="text-zinc-400 text-sm">@{user.username}</p>
            {user.bio && <p className="text-zinc-300 text-sm mt-1 line-clamp-2">{user.bio}</p>}
            <p className="text-zinc-500 text-xs mt-1">{myVideos.length} video</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { setEditMode(!editMode); setUsername(user.username || ""); setDisplayName(user.displayName || ""); setBio(user.bio || ""); setSaveMsg(""); }}
            className="flex-1 py-2 bg-zinc-800 text-white text-sm font-semibold rounded-xl border border-zinc-700"
            data-testid="tg-edit-profile-btn"
          >
            Edit Profil
          </button>
          <button
            onClick={onLogout}
            className="w-10 h-10 bg-zinc-800 rounded-xl border border-zinc-700 flex items-center justify-center flex-shrink-0"
            data-testid="tg-logout-btn"
          >
            <LogOut className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editMode && (
        <div className="mx-4 mt-4 bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
          <p className="text-white font-semibold text-sm mb-3">Edit Profil</p>
          <input
            className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-700 focus:border-primary mb-3 placeholder-zinc-600"
            placeholder="Username (huruf, angka, _)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            data-testid="tg-username-input"
          />
          <input
            className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-700 focus:border-primary mb-3 placeholder-zinc-600"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            data-testid="tg-displayname-input"
          />
          <textarea
            className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-700 focus:border-primary mb-3 placeholder-zinc-600 resize-none h-16"
            placeholder="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            data-testid="tg-bio-input"
          />
          {saveMsg && <p className={clsx("text-xs mb-2", saveMsg.includes("Gagal") ? "text-red-400" : "text-green-400")}>{saveMsg}</p>}
          <div className="flex gap-2">
            <button onClick={() => setEditMode(false)} className="flex-1 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-sm font-medium border border-zinc-700">Batal</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-40" data-testid="tg-save-profile-btn">
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}

      {/* Video Grid */}
      <div className="px-4 mt-5">
        <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">Video Kamu</p>
        {myVideos.length === 0 ? (
          <div className="text-center py-10">
            <PlaySquare className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">Belum ada video</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 pb-6">
            {myVideos.map((v) => (
              <div key={v.id} className="aspect-[9/16] bg-zinc-900 rounded-lg overflow-hidden relative" data-testid={`tg-myvideo-${v.id}`}>
                <video
                  src={v.fileUrl?.startsWith("/uploads/") ? v.fileUrl : `/api/videos/${v.id}/stream`}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                  <div className="flex items-center gap-1 text-white text-[10px]">
                    <Heart className="w-2.5 h-2.5" />
                    <span>{v.likeCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) { setError("Isi semua field"); return; }
    setLoading(true);
    try {
      const url = isLogin ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal");
      queryClient.setQueryData(["/api/auth/me"], data);
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end" onClick={onClose}>
      <div className="w-full bg-zinc-900 rounded-t-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <PlaySquare className="w-6 h-6 text-primary" fill="currentColor" />
            <span className="text-white font-bold text-lg">BigPekob</span>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-zinc-400" /></button>
        </div>

        <div className="flex bg-zinc-800 rounded-xl p-1 mb-5">
          <button
            className={clsx("flex-1 py-2 rounded-lg text-sm font-semibold transition", isLogin ? "bg-zinc-700 text-white" : "text-zinc-400")}
            onClick={() => { setIsLogin(true); setError(""); }}
          >Login</button>
          <button
            className={clsx("flex-1 py-2 rounded-lg text-sm font-semibold transition", !isLogin ? "bg-zinc-700 text-white" : "text-zinc-400")}
            onClick={() => { setIsLogin(false); setError(""); }}
          >Daftar</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              className="w-full bg-zinc-800 text-white rounded-xl pl-10 pr-4 py-3 text-sm outline-none border border-zinc-700 focus:border-primary placeholder-zinc-600"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              data-testid="tg-auth-username"
            />
          </div>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="password"
              className="w-full bg-zinc-800 text-white rounded-xl pl-10 pr-4 py-3 text-sm outline-none border border-zinc-700 focus:border-primary placeholder-zinc-600"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="tg-auth-password"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
            data-testid="tg-auth-submit"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</> : isLogin ? "Masuk" : "Daftar Sekarang"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function TelegramMiniApp() {
  const [tab, setTab] = useState<Tab>("feed");
  const [showAuth, setShowAuth] = useState(false);
  const [autoLoginDone, setAutoLoginDone] = useState(false);
  const queryClient = useQueryClient();

  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const telegramId = tgUser?.id;

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  useEffect(() => {
    if (!telegramId || autoLoginDone) return;
    setAutoLoginDone(true);
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (meRes.ok) {
          const meData = await meRes.json();
          queryClient.setQueryData(["/api/auth/me"], meData);
          return;
        }
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            initData: window.Telegram?.WebApp?.initData || "",
            telegramId,
            firstName: tgUser?.first_name,
            username: tgUser?.username,
            photoUrl: tgUser?.photo_url,
          }),
        });
        if (res.ok) {
          const userData = await res.json();
          queryClient.setQueryData(["/api/auth/me"], userData);
        }
      } catch {}
    })();
  }, [telegramId, autoLoginDone]);

  const { data: maintData } = useQuery<{ maintenance: boolean; message: string }>({
    queryKey: ["/api/maintenance"],
    staleTime: 30_000,
  });

  const { data: user } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: vipData } = useQuery<{ vip: boolean }>({
    queryKey: ["/api/vip/check", telegramId],
    queryFn: async () => {
      if (!telegramId) return { vip: false };
      const res = await fetch(`/api/vip/check?telegram_id=${telegramId}`);
      if (!res.ok) return { vip: false };
      return res.json();
    },
    enabled: !!telegramId,
    staleTime: 5 * 60 * 1000,
  });

  const isVip = vipData?.vip ?? false;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    queryClient.setQueryData(["/api/auth/me"], null);
    queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    setAutoLoginDone(false);
    setTab("feed");
  };

  const handleNeedLogin = () => {
    if (telegramId && !autoLoginDone) return;
    if (telegramId) {
      setAutoLoginDone(false);
      return;
    }
    setShowAuth(true);
  };

  const tabs: { key: Tab; icon: typeof Home; label: string }[] = [
    { key: "feed", icon: Home, label: "Beranda" },
    { key: "upload", icon: Upload, label: "Upload" },
    { key: "profile", icon: UserIcon, label: "Profil" },
  ];

  if (maintData?.maintenance) {
    return (
      <div className="w-full h-screen bg-zinc-950 flex items-center justify-center px-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-4xl">🔧</span>
          </div>
          <h1 className="text-white font-bold text-2xl mb-2">Maintenance</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">{maintData.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative flex flex-col">
      <div className="flex-1 overflow-hidden relative">
        <div className={tab === "feed" ? "block w-full h-full" : "hidden"}>
          <FeedTab user={user} onNeedLogin={handleNeedLogin} isVip={isVip} telegramId={telegramId} />
        </div>
        <div className={tab === "upload" ? "block w-full h-full" : "hidden"}>
          <UploadTab user={user} onNeedLogin={handleNeedLogin} />
        </div>
        <div className={tab === "profile" ? "block w-full h-full" : "hidden"}>
          <ProfileTab user={user} onNeedLogin={handleNeedLogin} onLogout={handleLogout} />
        </div>
      </div>

      <div className="flex-shrink-0 bg-zinc-950 border-t border-zinc-800 flex items-center safe-area-bottom">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              "flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition",
              tab === key ? "text-primary" : "text-zinc-600"
            )}
            data-testid={`tg-tab-${key}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>

      {showAuth && !telegramId && (
        <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />
      )}
    </div>
  );
}
