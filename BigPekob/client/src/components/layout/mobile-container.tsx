import { ReactNode } from "react";

export function MobileContainer({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full h-[100dvh] max-w-[420px] bg-zinc-950 relative overflow-hidden shadow-2xl sm:border-x sm:border-zinc-800">
        {children}
      </div>
    </div>
  );
}
