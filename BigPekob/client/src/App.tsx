import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { MobileContainer } from "./components/layout/mobile-container";
import { BottomNav } from "./components/layout/bottom-nav";

// Pages
import FeedPage from "./pages/feed";
import UploadPage from "./pages/upload";
import AuthPage from "./pages/auth";
import ProfilePage from "./pages/profile";
import DiscoverPage from "./pages/discover";
import InboxPage from "./pages/inbox";

function Router() {
  const [location] = useLocation();

  const showBottomNav = !["/auth", "/upload"].includes(location) && !location.startsWith("/upload");

  return (
    <MobileContainer>
      <Switch>
        <Route path="/" component={FeedPage} />
        <Route path="/discover" component={DiscoverPage} />
        <Route path="/upload" component={UploadPage} />
        <Route path="/inbox" component={InboxPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/profile/:userId" component={ProfilePage} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
      {showBottomNav && <BottomNav />}
    </MobileContainer>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
