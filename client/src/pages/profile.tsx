import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { LogOut, User, LayoutGrid, Heart, Bookmark, Menu, Play } from "lucide-react";
import { useEffect } from "react";

export default function ProfilePage() {
  const { user, isLoading, logout } = useAuth();
  const [, setLocation] = useLocation();

  // If finish loading and no user, go to auth
  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading || !user) {
    return (
      <div className="w-full h-full bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col relative text-white">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-zinc-900">
        <div className="w-8"></div>
        <h1 className="text-[17px] font-bold">{user.username}</h1>
        <button onClick={() => logout()} className="p-2 hover:bg-zinc-900 rounded-full transition">
          <LogOut className="w-5 h-5 text-zinc-400 hover:text-red-400" />
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-[60px]">
        {/* Profile Info */}
        <div className="flex flex-col items-center pt-6 pb-4">
          <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center mb-4 relative">
            <User className="w-10 h-10 text-zinc-500" />
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-primary rounded-full border-2 border-zinc-950 flex items-center justify-center">
               <Menu className="w-3 h-3 text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold">@{user.username}</h2>
          
          {/* Stats */}
          <div className="flex items-center gap-6 mt-4">
            <div className="flex flex-col items-center">
              <span className="font-bold text-[17px]">12</span>
              <span className="text-xs text-zinc-400">Following</span>
            </div>
            <div className="w-px h-6 bg-zinc-800"></div>
            <div className="flex flex-col items-center">
              <span className="font-bold text-[17px]">10.5K</span>
              <span className="text-xs text-zinc-400">Followers</span>
            </div>
            <div className="w-px h-6 bg-zinc-800"></div>
            <div className="flex flex-col items-center">
              <span className="font-bold text-[17px]">1.2M</span>
              <span className="text-xs text-zinc-400">Likes</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-6">
            <button className="px-10 py-3 bg-zinc-900 hover:bg-zinc-800 rounded-lg font-semibold text-[15px] transition-colors">
              Edit profile
            </button>
            <button className="px-4 py-3 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors">
              <Bookmark className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab System */}
        <div className="flex border-b border-zinc-900 sticky top-0 bg-zinc-950 z-10">
          <div className="flex-1 flex justify-center py-3 border-b-2 border-white text-white">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div className="flex-1 flex justify-center py-3 text-zinc-600">
            <Heart className="w-6 h-6" />
          </div>
        </div>

        {/* Video Grid (Mock) */}
        <div className="grid grid-cols-3 gap-0.5">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="aspect-[3/4] bg-zinc-900 relative group overflow-hidden">
               <div className="absolute inset-0 flex items-center justify-center opacity-20">
                 <User className="w-8 h-8" />
               </div>
               <div className="absolute bottom-2 left-2 flex items-center gap-1 text-xs font-semibold">
                 <Play className="w-3 h-3" />
                 <span>{Math.floor(Math.random() * 900) + 10}K</span>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
