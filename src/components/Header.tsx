import { Link, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const Header = ({ onToggleSidebar }: HeaderProps) => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="border-b border-border">
      <div className="max-w-full mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="font-heading font-semibold tracking-tight" style={{ fontSize: '22px', color: '#D4A843' }}>
              Scry
            </span>
          </Link>
        </div>
        <nav className="flex items-center gap-6">
          {userEmail ? (
            <div className="flex items-center gap-4">
              <span className="hidden lg:inline text-sm font-body text-muted-foreground">{userEmail}</span>
              <button
                onClick={handleSignOut}
                className="text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;