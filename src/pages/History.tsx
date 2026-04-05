import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { Search } from "lucide-react";

const History = () => {
  // TODO: Fetch from Supabase
  const teardowns: Array<{
    id: string;
    product_name: string;
    mode: "generate" | "critique";
    created_at: string;
  }> = [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-[860px] mx-auto px-6 py-12">
        <h1 className="font-heading text-4xl font-semibold text-foreground mb-8">History</h1>

        <div className="relative mb-8">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search teardowns..."
            className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-2 pl-6 text-sm font-body text-foreground placeholder:text-muted-foreground/50 transition-colors"
          />
        </div>

        {teardowns.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-body text-muted-foreground mb-4">No teardowns yet.</p>
            <div className="flex items-center justify-center gap-4">
              <Link
                to="/generate"
                className="text-sm text-amber-accent hover:opacity-80 transition-opacity font-body"
              >
                Generate a teardown
              </Link>
              <span className="text-muted-foreground/30">|</span>
              <Link
                to="/critique"
                className="text-sm text-amber-accent hover:opacity-80 transition-opacity font-body"
              >
                Submit for critique
              </Link>
            </div>
          </div>
        ) : (
          <div>
            {teardowns.map((t) => (
              <Link
                key={t.id}
                to={`/${t.mode}/${t.id}`}
                className="flex items-center justify-between py-4 border-b border-border hover:bg-card/50 transition-colors -mx-3 px-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-body font-medium text-foreground">{t.product_name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-amber-accent border border-primary/30 px-2 py-0.5">
                    {t.mode}
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default History;
