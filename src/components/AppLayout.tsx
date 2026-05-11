import { useState, useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";
import HistorySidebar from "./HistorySidebar";
import { supabase } from "@/lib/supabase";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
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
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default AppLayout;