import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, X, Trash2 } from "lucide-react";
import { getHistory, deleteEntry, type HistoryEntry } from "@/lib/history";

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type FilterTab = "all" | "generate" | "critique";

const HistorySidebar = ({ isOpen, onClose }: HistorySidebarProps) => {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const loadEntries = async () => {
    const data = await getHistory();
    setEntries(data);
  };

  useEffect(() => {
    loadEntries();
    const handler = () => loadEntries();
    window.addEventListener("shard_history_updated", handler);
    return () => window.removeEventListener("shard_history_updated", handler);
  }, []);

  const filtered = entries.filter((entry) => {
    const matchesTab = activeTab === "all" || entry.mode === activeTab;
    const matchesSearch = entry.product_name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "generate", label: "Teardowns" },
    { key: "critique", label: "Critiques" },
  ];

  const handleDelete = async (e: React.MouseEvent, entry: HistoryEntry) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteEntry(entry.id);
    setConfirmingId(null);
    if (location.pathname === `/${entry.mode}/${entry.id}`) {
      navigate(`/${entry.mode}`);
    }
  };

  const emptyMessage = () => {
    if (activeTab === "generate") return { text: "No teardowns yet.", link: "/generate", linkText: "Generate a teardown" };
    if (activeTab === "critique") return { text: "No critiques yet.", link: "/critique", linkText: "Submit for critique" };
    return { text: "No teardowns yet.", link: "/generate", linkText: "Generate a teardown" };
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 min-h-screen w-72 bg-card border-r border-border flex flex-col overflow-hidden transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:relative lg:z-auto ${isOpen ? "lg:translate-x-0" : "lg:-translate-x-full lg:w-0 lg:border-0"}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">History</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors lg:hidden">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-4 px-4 pt-3 border-b border-border shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-2 text-xs font-body transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="px-4 py-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-1.5 pl-5 text-xs font-body text-foreground placeholder:text-muted-foreground/50 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-2">
          {filtered.length === 0 ? (
            <div className="py-12 text-center px-4">
              <p className="font-body text-xs text-muted-foreground mb-3">{emptyMessage().text}</p>
              <Link
                to={emptyMessage().link}
                className="text-xs text-primary hover:opacity-80 transition-opacity font-body"
              >
                {emptyMessage().linkText}
              </Link>
            </div>
          ) : (
            filtered.map((entry) => (
              <div
                key={entry.id}
                className="group relative flex items-center border-b border-border hover:bg-secondary/50 transition-colors"
              >
                <Link
                  to={`/${entry.mode}/${entry.id}`}
                  className="flex items-center justify-between py-3 px-2 flex-1 min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-body text-xs font-medium text-foreground truncate">{entry.product_name}</span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-primary border border-primary/40 px-1.5 py-0.5 shrink-0">
                      {entry.mode === "generate" ? "Teardown" : "Critique"}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 ml-2">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                </Link>

                {confirmingId === entry.id ? (
                  <div className="flex items-center gap-1 pr-2 shrink-0">
                    <button
                      onClick={(e) => handleDelete(e, entry)}
                      className="font-mono text-[10px] text-destructive hover:opacity-80 transition-opacity px-1"
                    >
                      delete
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); setConfirmingId(null); }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.preventDefault(); setConfirmingId(entry.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity pr-2 shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
};

export default HistorySidebar;