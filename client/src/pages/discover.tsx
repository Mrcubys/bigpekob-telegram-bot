import { useState } from "react";
import { Search, User, UserPlus, UserCheck, Loader2 } from "lucide-react";
import { useSearchUsers } from "@/hooks/use-search";
import { useFollow } from "@/hooks/use-follow";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: results = [], isLoading } = useSearchUsers(query);
  const followMutation = useFollow();

  const handleFollow = (e: React.MouseEvent, userId: number) => {
    e.stopPropagation();
    if (!user) { setLocation("/auth"); return; }
    followMutation.mutate(userId);
  };

  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <div className="w-full h-full bg-zinc-950 text-white flex flex-col">
      {/* Search Header */}
      <header className="p-4 flex gap-3 items-center border-b border-zinc-900 bg-zinc-950 sticky top-0 z-10">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users by username..."
            className="w-full bg-zinc-900 rounded-xl py-2.5 pl-10 pr-4 text-[15px] focus:outline-none focus:ring-1 focus:ring-primary text-white placeholder:text-zinc-500"
            data-testid="input-search"
            autoComplete="off"
          />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-[70px]">
        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        {/* Results */}
        {!isLoading && query.trim() && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-3">
            <User className="w-12 h-12" />
            <p className="text-sm">No users found for &quot;{query}&quot;</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="divide-y divide-zinc-900">
            {results.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/50 transition cursor-pointer active:bg-zinc-900"
                onClick={() => setLocation(`/profile/${u.id}`)}
                data-testid={`user-card-${u.id}`}
              >
                <div className="w-12 h-12 bg-zinc-800 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {u.avatarData ? (
                    <img src={u.avatarData} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <User className="w-6 h-6 text-zinc-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{u.displayName || u.username}</p>
                  <p className="text-zinc-400 text-sm truncate">@{u.username}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{formatCount(u.followerCount)} followers</p>
                </div>
                {user && user.id !== u.id && (
                  <button
                    onClick={(e) => handleFollow(e, u.id)}
                    disabled={followMutation.isPending}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      u.isFollowing
                        ? "bg-zinc-800 text-white"
                        : "bg-primary text-white hover:bg-primary/80"
                    }`}
                    data-testid={`button-follow-user-${u.id}`}
                  >
                    {u.isFollowing ? (
                      <span className="flex items-center gap-1"><UserCheck className="w-4 h-4" /> Following</span>
                    ) : (
                      <span className="flex items-center gap-1"><UserPlus className="w-4 h-4" /> Follow</span>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!query.trim() && (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600 gap-3 px-6 text-center">
            <Search className="w-14 h-14" />
            <h3 className="text-lg font-semibold text-zinc-400">Find People</h3>
            <p className="text-sm text-zinc-500">Search for users by username to discover and follow creators</p>
          </div>
        )}
      </div>
    </div>
  );
}
