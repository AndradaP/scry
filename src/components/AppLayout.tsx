import { useState, useEffect } from "react";
import Header from "./Header";
import HistorySidebar from "./HistorySidebar";
import { supabase } from "@/lib/supabase";

interface AppLayoutProps {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}

const AppLayout = ({ children, rightPanel }: AppLayoutProps) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (rightPanel !== undefined) {
    return (
      <div
        style={{
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "hsl(var(--background))",
        }}
      >
        <Header onToggleSidebar={isLoggedIn ? () => setSidebarOpen(!sidebarOpen) : undefined} />
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          {isLoggedIn && (
            <HistorySidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          )}
          <div style={{ flex: 1, display: "flex", overflow: "hidden", minWidth: 0 }}>
            <main style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {children}
            </main>
            {rightPanel}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        onToggleSidebar={isLoggedIn ? () => setSidebarOpen(!sidebarOpen) : undefined}
      />
      <div className="flex flex-1">
        {isLoggedIn && (
          <HistorySidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 flex flex-col">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
