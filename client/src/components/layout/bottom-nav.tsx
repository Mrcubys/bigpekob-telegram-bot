import { Link, useLocation } from "wouter";
import { Home, Compass, Plus, MessageSquare, User } from "lucide-react";
import { clsx } from "clsx";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Compass, label: "Discover", href: "/discover" },
  ];

  const rightNavItems = [
    { icon: MessageSquare, label: "Inbox", href: "/inbox" },
    { icon: User, label: "Profile", href: "/profile" },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[60px] bg-zinc-950/90 backdrop-blur-lg border-t border-zinc-900 flex items-center justify-between px-2 z-50">
      {navItems.map((item) => {
        const isActive = location === item.href;
        const Icon = item.icon;
        return (
          <Link key={item.label} href={item.href} className="flex-1 flex flex-col items-center justify-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
            <Icon className={clsx("w-6 h-6", isActive ? "text-white" : "text-zinc-400")} strokeWidth={isActive ? 2.5 : 2} />
            <span className={clsx("text-[10px] font-medium", isActive ? "text-white" : "text-zinc-400")}>{item.label}</span>
          </Link>
        );
      })}

      <Link href="/upload" className="flex-1 flex items-center justify-center group active:scale-95 transition-transform">
        <div className="h-8 w-12 bg-white rounded-xl flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-primary to-primary opacity-20"></div>
          <Plus className="w-6 h-6 text-black z-10" strokeWidth={3} />
          {/* Faux TikTok 3D effect */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400"></div>
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-rose-500"></div>
        </div>
      </Link>

      {rightNavItems.map((item) => {
        const isActive = location === item.href;
        const Icon = item.icon;
        return (
          <Link key={item.label} href={item.href} className="flex-1 flex flex-col items-center justify-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
            <Icon className={clsx("w-6 h-6", isActive ? "text-white" : "text-zinc-400")} strokeWidth={isActive ? 2.5 : 2} />
            <span className={clsx("text-[10px] font-medium", isActive ? "text-white" : "text-zinc-400")}>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
