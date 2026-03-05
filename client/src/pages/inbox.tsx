import { useAuth } from "@/hooks/use-auth";
import { MessageSquare, Bell, Users, Heart } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function InboxPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth");
    }
  }, [user, isLoading, setLocation]);

  const activities = [
    { icon: Bell, color: "bg-rose-500", title: "New followers", desc: "Start following back" },
    { icon: Heart, color: "bg-primary", title: "Activities", desc: "Likes and comments" },
    { icon: Users, color: "bg-blue-500", title: "System notifications", desc: "Updates from BigPekob" }
  ];

  return (
    <div className="w-full h-full bg-zinc-950 text-white flex flex-col relative">
      <header className="p-4 border-b border-zinc-900 flex justify-center items-center">
        <h1 className="text-lg font-bold">Inbox</h1>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-[70px]">
        {/* Top actions */}
        <div className="flex justify-between px-6 py-6 border-b border-zinc-900/50">
          {activities.map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className={`w-14 h-14 ${item.color} rounded-xl flex items-center justify-center shadow-lg`}>
                <item.icon className="w-7 h-7 text-white" />
              </div>
              <span className="text-xs font-medium text-center w-20 leading-tight">{item.title}</span>
            </div>
          ))}
        </div>

        {/* Messages list */}
        <div className="p-4">
          <h2 className="text-sm font-semibold text-zinc-400 mb-4">Messages</h2>
          
          <div className="flex flex-col items-center justify-center py-10 opacity-60 text-center">
            <MessageSquare className="w-12 h-12 mb-4 text-zinc-600" />
            <p className="font-semibold">Message your friends</p>
            <p className="text-sm text-zinc-400 max-w-[200px] mt-1">Share videos or start a conversation.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
