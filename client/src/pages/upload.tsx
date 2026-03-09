import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useUploadVideo } from "@/hooks/use-videos";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Upload, Loader2, Video as VideoIcon } from "lucide-react";
import { clsx } from "clsx";

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { mutateAsync: uploadVideo, isPending } = useUploadVideo();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isAuthLoading && !user) {
    setLocation("/auth");
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setError("");
      setProgress(0);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError("Please select a video file"); return; }
    if (!title.trim()) { setError("Please enter a title"); return; }

    setProgress(0);
    try {
      await uploadVideo({
        file,
        title,
        description,
        onProgress: (pct) => setProgress(pct),
      });
      setLocation("/");
    } catch (err: any) {
      setError(err.message || "Failed to upload video");
      setProgress(0);
    }
  };

  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col relative z-50">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-950">
        <button onClick={() => setLocation("/")} className="p-2 -ml-2 rounded-full hover:bg-zinc-900 transition" data-testid="button-back-upload">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">Create Post</h1>
        <div className="w-10"></div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 no-scrollbar">
        <form onSubmit={handleUpload} className="space-y-6">
          {/* File Selector */}
          <div
            className={clsx(
              "w-full aspect-[3/4] max-h-[400px] rounded-xl border-2 border-dashed overflow-hidden relative transition-colors flex items-center justify-center",
              file ? "border-primary/50 bg-black" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
            )}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <>
                <video src={previewUrl} className="w-full h-full object-contain" autoPlay muted loop playsInline />
                <button
                  type="button"
                  onClick={() => { setFile(null); setPreviewUrl(null); setProgress(0); }}
                  className="absolute top-4 right-4 bg-black/60 backdrop-blur text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-black/80 transition"
                  data-testid="button-change-video"
                >
                  Change Video
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center cursor-pointer">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-zinc-400" />
                </div>
                <p className="text-white font-semibold text-lg mb-2">Select video to upload</p>
                <p className="text-zinc-400 text-sm max-w-[200px]">MP4, WebM, or MOV • Up to 1 hour</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileChange}
              data-testid="input-video-file"
            />
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-zinc-400 text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Awesome video title..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                disabled={isPending}
                data-testid="input-video-title"
              />
            </div>

            <div>
              <label className="block text-zinc-400 text-sm font-medium mb-2">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="#fyp #trending..."
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                disabled={isPending}
                data-testid="input-video-description"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="h-24"></div>
        </form>
      </main>

      {/* Fixed bottom actions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-900 flex gap-3">
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="flex-1 py-3.5 px-4 rounded-xl font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition"
          disabled={isPending}
          data-testid="button-cancel-upload"
        >
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={!file || isPending}
          className="flex-[2] py-3.5 px-4 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          data-testid="button-post-video"
        >
          {isPending ? (
            <><Loader2 className="w-5 h-5 animate-spin" />{progress > 0 ? `${progress}%` : "Uploading..."}</>
          ) : (
            "Post"
          )}
        </button>
      </div>

      {/* Full-screen upload overlay */}
      {isPending && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="absolute w-24 h-24 -rotate-90" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <circle
                cx="48" cy="48" r="44" fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>
            <VideoIcon className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold">Publishing video</h2>
            <p className="text-zinc-400 mt-1 text-sm">{progress}% uploaded — please keep the app open</p>
          </div>
          <div className="w-64 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
