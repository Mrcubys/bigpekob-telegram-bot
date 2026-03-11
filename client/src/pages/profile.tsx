import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useParams } from "wouter";
import { useUserVideos } from "@/hooks/use-videos";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useFollow } from "@/hooks/use-follow";
import { LogOut, User, LayoutGrid, Play, Settings, ArrowLeft, Camera, UserPlus, UserCheck, Loader2, X, Check } from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";

function EditProfileModal({ user, onClose }: { user: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState(user.username || "");
  const [bio, setBio] = useState(user.bio || "");
  const [avatarData, setAvatarData] = useState<string | null>(user.avatarData || null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateMutation = useMutation({
    mutationFn: async (data: { username?: string; bio?: string; avatarData?: string }) => {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError("Username can only contain letters, numbers and underscores");
      return;
    }
    setError("");
    updateMutation.mutate({
      username: trimmed !== user.username ? trimmed : undefined,
      bio: bio.trim() || undefined,
      avatarData: avatarData || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <header className="flex items-center justify-between p-4 border-b border-zinc-900">
        <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-full transition" data-testid="button-cancel-edit">
          <X className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-[17px] font-bold text-white">Edit Profile</h1>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="p-2 hover:bg-zinc-900 rounded-full transition text-primary font-semibold disabled:opacity-50"
          data-testid="button-save-profile"
        >
          {updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-24 h-24 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
              {avatarData ? (
                <img src={avatarData} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-zinc-500" />
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center border-2 border-zinc-950">
              <Camera className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <p className="text-zinc-400 text-sm">Change photo</p>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        {/* Username */}
        <div>
          <label className="block text-zinc-400 text-sm font-medium mb-2">Username</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-[15px]">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              placeholder="username"
              maxLength={30}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary transition"
              data-testid="input-username"
            />
          </div>
          <p className="text-zinc-600 text-xs mt-1">Letters, numbers and underscores only</p>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-zinc-400 text-sm font-medium mb-2">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people about yourself..."
            maxLength={200}
            rows={4}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary transition resize-none"
            data-testid="input-bio"
          />
          <p className="text-zinc-600 text-xs mt-1 text-right">{bio.length}/200</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams<{ userId?: string }>();
  const { user: authUser, isLoading: isAuthLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [showEdit, setShowEdit] = useState(false);
  const followMutation = useFollow();

  const targetUserId = params.userId ? parseInt(params.userId) : authUser?.id;
  const isOwnProfile = !params.userId || (authUser && parseInt(params.userId) === authUser.id);

  const { data: profile, isLoading: isProfileLoading } = useUserProfile(targetUserId);
  const { data: videos = [], isLoading: isVideosLoading } = useUserVideos(targetUserId);

  useEffect(() => {
    if (!isAuthLoading && !authUser && isOwnProfile) {
      setLocation("/auth");
    }
  }, [authUser, isAuthLoading, isOwnProfile, setLocation]);

  const isLoading = isAuthLoading || isProfileLoading;

  if (isLoading) {
    return (
      <div className="w-full h-full bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!profile && !isOwnProfile) {
    return (
      <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center text-white gap-4">
        <User className="w-12 h-12 text-zinc-600" />
        <p className="text-zinc-400">User not found</p>
        <button onClick={() => setLocation("/")} className="text-primary text-sm">Go back</button>
      </div>
    );
  }

  const displayProfile = profile || authUser;
  const followerCount = profile?.followerCount ?? 0;
  const followingCount = profile?.followingCount ?? 0;
  const videoCount = profile?.videoCount ?? 0;
  const isFollowing = profile?.isFollowing ?? false;

  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  const totalLikes = videos.reduce((sum, v) => sum + (v.likeCount || 0), 0);

  const handleFollow = () => {
    if (!authUser) { setLocation("/auth"); return; }
    if (targetUserId) followMutation.mutate(targetUserId);
  };

  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col relative text-white">
      {showEdit && authUser && (
        <EditProfileModal user={authUser} onClose={() => setShowEdit(false)} />
      )}

      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-950 sticky top-0 z-10">
        {!isOwnProfile ? (
          <button onClick={() => setLocation("/")} className="p-2 hover:bg-zinc-900 rounded-full transition" data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        ) : (
          <div className="w-10" />
        )}
        <h1 className="text-[17px] font-bold">@{displayProfile?.username}</h1>
        {isOwnProfile ? (
          <button onClick={() => logout()} className="p-2 hover:bg-zinc-900 rounded-full transition" data-testid="button-logout">
            <LogOut className="w-5 h-5 text-zinc-400" />
          </button>
        ) : (
          <button className="p-2 hover:bg-zinc-900 rounded-full transition">
            <Settings className="w-5 h-5 text-zinc-400" />
          </button>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-[60px]">
        {/* Profile Info */}
        <div className="flex flex-col items-center pt-6 pb-4 px-4">
          {/* Avatar */}
          <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center mb-4 overflow-hidden">
            {displayProfile?.avatarData ? (
              <img src={displayProfile.avatarData} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-zinc-500" />
            )}
          </div>

          <h2 className="text-xl font-bold">{displayProfile?.displayName || `@${displayProfile?.username}`}</h2>
          {displayProfile?.displayName && (
            <p className="text-zinc-500 text-sm mt-0.5">@{displayProfile.username}</p>
          )}

          {displayProfile?.bio && (
            <p className="text-zinc-300 text-sm text-center mt-2 max-w-[260px] leading-snug">{displayProfile.bio}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 mt-5">
            <div className="flex flex-col items-center" data-testid="stat-following">
              <span className="font-bold text-[17px]">{formatCount(followingCount)}</span>
              <span className="text-xs text-zinc-400">Following</span>
            </div>
            <div className="w-px h-6 bg-zinc-800"></div>
            <div className="flex flex-col items-center" data-testid="stat-followers">
              <span className="font-bold text-[17px]">{formatCount(followerCount)}</span>
              <span className="text-xs text-zinc-400">Followers</span>
            </div>
            <div className="w-px h-6 bg-zinc-800"></div>
            <div className="flex flex-col items-center" data-testid="stat-likes">
              <span className="font-bold text-[17px]">{formatCount(totalLikes)}</span>
              <span className="text-xs text-zinc-400">Likes</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-5 w-full max-w-[300px]">
            {isOwnProfile ? (
              <button
                onClick={() => setShowEdit(true)}
                className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg font-semibold text-[15px] transition-colors"
                data-testid="button-edit-profile"
              >
                Edit profile
              </button>
            ) : (
              <button
                onClick={handleFollow}
                disabled={followMutation.isPending}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-[15px] transition-colors flex items-center justify-center gap-2 ${
                  isFollowing
                    ? "bg-zinc-900 hover:bg-zinc-800 text-white"
                    : "bg-primary hover:bg-primary/80 text-white"
                }`}
                data-testid="button-follow-profile"
              >
                {followMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isFollowing ? (
                  <><UserCheck className="w-4 h-4" /> Following</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Follow</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-900 sticky top-[65px] bg-zinc-950 z-10">
          <div className="flex-1 flex justify-center py-3 border-b-2 border-white text-white">
            <LayoutGrid className="w-6 h-6" />
          </div>
        </div>

        {/* Video Grid */}
        {isVideosLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600 gap-3">
            <Play className="w-12 h-12" />
            <p className="text-sm">No videos yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {videos.map((v) => (
              <div
                key={v.id}
                className="aspect-[3/4] bg-zinc-900 relative overflow-hidden cursor-pointer"
                data-testid={`video-thumb-${v.id}`}
              >
                <video
                  src={v.fileUrl ? (v.fileUrl.startsWith("/") ? v.fileUrl : `/${v.fileUrl}`) : `/api/videos/${v.id}/stream`}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute bottom-1.5 left-2 flex items-center gap-1 text-xs font-semibold text-white">
                  <Play className="w-3 h-3 fill-white" />
                  <span>{formatCount(v.likeCount ?? 0)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
