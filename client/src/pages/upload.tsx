import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useUploadVideo } from "@/hooks/use-videos";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Upload, Loader2, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not logged in
  if (!isAuthLoading && !user) {
    setLocation("/auth");
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 1024 * 1024 * 500) { // arbitrary frontend 500mb limit for safety, prompt mentioned up to 1hr
        setError("File size too large. Please select a smaller video.");
        return;
      }
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setError("");
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a video file");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a title");
      return;
    }

    try {
      await uploadVideo({ file, title, description });
      setLocation("/"); // Go back to feed after success
    } catch (err: any) {
      setError(err.message || "Failed to upload video");
    }
  };

  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col relative z-50">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-950">
        <button onClick={() => setLocation("/")} className="p-2 -ml-2 rounded-full hover:bg-zinc-900 transition">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">Create Post</h1>
        <div className="w-10"></div> {/* Spacer for center alignment */}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 no-scrollbar">
        <form onSubmit={handleUpload} className="space-y-6">
          
          {/* File Selector / Preview */}
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
                  onClick={() => { setFile(null); setPreviewUrl(null); }}
                  className="absolute top-4 right-4 bg-black/60 backdrop-blur text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-black/80 transition"
                >
                  Change Video
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center cursor-pointer">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4 text-zinc-400">
                  <Upload className="w-8 h-8" />
                </div>
                <p className="text-white font-semibold text-lg mb-2">Select video to upload</p>
                <p className="text-zinc-400 text-sm max-w-[200px]">Supports MP4, WebM, or MOV up to 1 hour in length</p>
              </div>
            )}
            <input 
              ref={fileInputRef}
              type="file" 
              accept="video/*" 
              className="hidden" 
              onChange={handleFileChange}
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
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Spacer so it scrolls past the bottom nav if needed */}
          <div className="h-20"></div>
        </form>
      </main>

      {/* Fixed bottom actions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-900 flex gap-3">
        <button 
          type="button"
          onClick={() => setLocation("/")}
          className="flex-1 py-3.5 px-4 rounded-xl font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition"
          disabled={isPending}
        >
          Drafts
        </button>
        <button 
          onClick={handleUpload}
          disabled={!file || isPending}
          className="flex-[2] py-3.5 px-4 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Uploading...
            </>
          ) : (
            "Post"
          )}
        </button>
      </div>

      {/* Full screen upload overlay */}
      {isPending && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white">
          <div className="w-20 h-20 relative flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin absolute" />
            <VideoIcon className="w-5 h-5 text-white absolute animate-pulse" />
          </div>
          <h2 className="text-xl font-bold mt-4">Publishing</h2>
          <p className="text-zinc-400 mt-2 text-sm">Please keep the app open...</p>
        </div>
      )}
    </div>
  );
}
