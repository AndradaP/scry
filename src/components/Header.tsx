import { Link, useLocation } from "react-router-dom";

const Header = () => {
  const location = useLocation();

  return (
    <header className="border-b border-border">
      <div className="max-w-[860px] mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-heading text-2xl font-semibold tracking-tight text-foreground hover:text-amber-accent transition-colors">
          The Shard
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            to="/history"
            className={`text-sm font-body transition-colors ${
              location.pathname === "/history"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            History
          </Link>
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
