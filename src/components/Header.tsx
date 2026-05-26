import { Link, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const Header = ({ onToggleSidebar }: HeaderProps) => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState<number | null>(null);
  const navigate = useNavigate();

  const fetchUsageCount = async (uid: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("usage_limits")
      .select("teardown_count")
      .eq("user_id", uid)
      .eq("date", today)
      .single();
    setUsageCount(data?.teardown_count ?? 0);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
      if (session?.user?.id) {
        setUserId(session.user.id);
        fetchUsageCount(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (session?.user?.id) {
        setUserId(session.user.id);
        fetchUsageCount(session.user.id);
      } else {
        setUserId(null);
        setUsageCount(null);
      }
    });

    const handleUsageUpdate = () => {
      if (userId) fetchUsageCount(userId);
    };
    window.addEventListener("shard_usage_updated", handleUsageUpdate);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("shard_usage_updated", handleUsageUpdate);
    };
  }, [userId]);

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
            <span className="font-heading text-2xl font-semibold tracking-tight">
              <span className="text-foreground">The </span><span className="text-primary">Shard</span>
            </span>
          </Link>
        </div>
        <nav className="flex items-center gap-6">
          {userEmail ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-body text-muted-foreground">{userEmail}</span>
              {usageCount !== null && (
                <span className="text-xs font-mono" style={{ color: "#5A5550" }}>
                  {usageCount} of 5 today
                </span>
              )}
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