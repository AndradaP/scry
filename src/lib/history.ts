export interface HistoryEntry {
  id: string;
  product_name: string;
  mode: "generate" | "critique";
  created_at: string;
  sections: { key: string; label: string; content: string }[];
  chatMessages: { id: string; role: "user" | "assistant"; content: string }[];
}

const STORAGE_KEY = "shard_history";

export const getHistory = (): HistoryEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveEntry = (entry: HistoryEntry): void => {
  const history = getHistory();
  const existing = history.findIndex((h) => h.id === entry.id);
  if (existing >= 0) {
    history[existing] = entry;
  } else {
    history.unshift(entry);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  window.dispatchEvent(new Event("shard_history_updated"));
};

export const getEntry = (id: string): HistoryEntry | undefined => {
  return getHistory().find((h) => h.id === id);
};
