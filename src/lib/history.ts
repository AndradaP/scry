import { supabase } from "./supabase";

export interface HistoryEntry {
  id: string;
  product_name: string;
  mode: "generate" | "critique";
  created_at: string;
  sections: { key: string; label: string; content: string }[];
  chatMessages: { id: string; role: "user" | "assistant"; content: string }[];
}

export const getHistory = async (): Promise<HistoryEntry[]> => {
  const { data, error } = await supabase
    .from("teardowns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    product_name: row.product_name,
    mode: row.mode,
    created_at: row.created_at,
    sections: row.output?.sections ?? [],
    chatMessages: row.output?.chatMessages ?? [],
  }));
};

export const saveEntry = async (entry: HistoryEntry): Promise<void> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user) {
    return;
  }

  await supabase
    .from("teardowns")
    .upsert({
      id: entry.id,
      user_id: user.id,
      mode: entry.mode,
      product_name: entry.product_name,
      output: {
        sections: entry.sections,
        chatMessages: entry.chatMessages,
      },
      created_at: entry.created_at,
    });

  window.dispatchEvent(new Event("shard_history_updated"));
};

export const getEntry = async (id: string): Promise<HistoryEntry | undefined> => {
  const { data, error } = await supabase
    .from("teardowns")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return undefined;

  return {
    id: data.id,
    product_name: data.product_name,
    mode: data.mode,
    created_at: data.created_at,
    sections: data.output?.sections ?? [],
    chatMessages: data.output?.chatMessages ?? [],
  };
};