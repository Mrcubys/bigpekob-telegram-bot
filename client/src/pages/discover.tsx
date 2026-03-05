import { Search, Compass, Hash } from "lucide-react";

export default function DiscoverPage() {
  const trendingTags = [
    { tag: "foryou", views: "3.4B" },
    { tag: "dance", views: "1.2B" },
    { tag: "comedy", views: "892M" },
    { tag: "bigpekob", views: "441M" },
  ];

  return (
    <div className="w-full h-full bg-zinc-950 text-white flex flex-col relative">
      {/* Search Header */}
      <header className="p-4 flex gap-3 items-center border-b border-zinc-900">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search BigPekob" 
            className="w-full bg-zinc-900 rounded-lg py-2.5 pl-10 pr-4 text-[15px] focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-[70px]">
        {/* Carousel Placeholder */}
        <div className="w-full aspect-[21/9] bg-gradient-to-r from-zinc-800 to-zinc-900 flex items-center justify-center p-6 relative">
           <Compass className="w-12 h-12 text-zinc-700 opacity-50 absolute" />
           <div className="text-center z-10">
             <h2 className="text-xl font-bold text-white text-shadow">Discover Trends</h2>
             <p className="text-sm text-zinc-300">Find what's popular now</p>
           </div>
        </div>

        <div className="p-4 space-y-6">
          {trendingTags.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center">
                    <Hash className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold">{item.tag}</h3>
                    <p className="text-xs text-zinc-400">Trending Hashtag</p>
                  </div>
                </div>
                <div className="bg-zinc-900 px-3 py-1 rounded-sm text-xs font-semibold">
                  {item.views} {'>'}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[1,2,3].map((i) => (
                  <div key={i} className="aspect-[3/4] bg-zinc-800 rounded-sm"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
