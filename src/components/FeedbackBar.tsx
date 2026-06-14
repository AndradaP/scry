import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const LABELS = ["Not useful", "Useful", "Excellent"] as const;

interface FeedbackBarProps {
  teardownId: string;
}

export const FeedbackBar = ({ teardownId }: FeedbackBarProps) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchExisting = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("teardown_feedback")
        .select("rating")
        .eq("teardown_id", teardownId)
        .eq("user_id", user.id)
        .single();
      if (data) setSelected(data.rating);
    };
    fetchExisting();
  }, [teardownId]);

  const handleSelect = async (rating: number) => {
    if (saving || !teardownId) return;
    setSaving(true);
    setSelected(rating);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from("teardown_feedback")
        .upsert(
          { teardown_id: teardownId, user_id: user.id, rating },
          { onConflict: "teardown_id,user_id" }
        );
      if (error) console.error("[FeedbackBar] upsert failed:", error.code, error.message, error.details);
    } else {
      console.warn("[FeedbackBar] no authenticated user");
    }
    setSaving(false);
  };

  return (
    <div className="mt-16 pt-8 border-t border-border flex items-center gap-1">
      <span className="font-mono text-xs text-muted-foreground/50 mr-3">Was this useful?</span>
      {LABELS.map((label, i) => (
        <button
          key={i}
          onClick={() => handleSelect(i)}
          disabled={saving}
          className={`px-3 py-1.5 font-mono text-xs transition-colors border ${
            selected === i
              ? "border-primary text-primary"
              : "border-border text-muted-foreground hover:border-muted-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
