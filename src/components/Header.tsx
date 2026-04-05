import { Link, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import ShardLogo from "./ShardLogo";

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const Header = ({ onToggleSidebar }: HeaderProps) => {
  const location = useLocation();

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
            <ShardLogo size={24} />
            <span className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              The Shard
            </span>
          </Link>
        </div>
        <nav className="flex items-center gap-6">
          <Link
            to="/login"
            className="text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
