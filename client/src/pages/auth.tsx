import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, User, KeyRound, PlaySquare } from "lucide-react";
import { clsx } from "clsx";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { login, register, isLoggingIn, isRegistering } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const isPending = isLoggingIn || isRegistering;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    try {
      if (isLogin) {
        await login({ username, password });
      } else {
        await register({ username, password });
      }
      setLocation("/");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    }
  };

  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden z-50">
      
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        
        {/* Logo/Brand */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-tr from-primary to-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25 mb-4">
            <PlaySquare className="w-8 h-8 text-white ml-1" fill="currentColor" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">BigPekob</h1>
          <p className="text-zinc-400 mt-2 font-medium">Log in to BigPekob</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-zinc-900 rounded-xl p-1 mb-8 shadow-inner">
          <button
            type="button"
            className={clsx(
              "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
              isLogin ? "bg-zinc-800 text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"
            )}
            onClick={() => { setIsLogin(true); setError(""); }}
          >
            Log In
          </button>
          <button
            type="button"
            className={clsx(
              "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
              !isLogin ? "bg-zinc-800 text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"
            )}
            onClick={() => { setIsLogin(false); setError(""); }}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="w-5 h-5 text-zinc-500" />
              </div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                disabled={isPending}
              />
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <KeyRound className="w-5 h-5 text-zinc-500" />
              </div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                disabled={isPending}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-2 rounded-lg border border-red-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-4 bg-primary text-white rounded-xl font-bold text-[15px] hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4 shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isLogin ? (
              "Log In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
