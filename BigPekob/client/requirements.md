## Packages
react-intersection-observer | To detect which video is currently in the viewport for autoplay/pause functionality
lucide-react | High quality icons for the UI
clsx | Conditional class names merging
tailwind-merge | Merging tailwind classes safely

## Notes
- `react-intersection-observer` is critical for the full-screen scroll-snap video feed to know which video should be playing.
- File upload uses raw `fetch` to send `FormData` to `/api/videos`, relying on the backend to handle the multipart parsing. No `Content-Type` header is set manually so the browser attaches the correct boundary.
- The UI is built using a mobile-first "app container" wrapper. On desktop, it will look like a phone screen centered on the page for an authentic TikTok-like experience.
