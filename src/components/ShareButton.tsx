import { useState } from "react";
import { Link2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ShareButtonProps {
  teardownId: string;
}

const ShareButton = ({ teardownId }: ShareButtonProps) => {
  const [isPublic, setIsPublic] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `https://the-shard-five.vercel.app/teardown/${teardownId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    if (!isPublic) {
      setIsPublic(true);
      supabase
        .from("teardowns")
        .update({ is_public: true })
        .eq("id", teardownId)
        .then();
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-body text-amber-accent border border-primary hover:bg-primary hover:text-primary-foreground transition-colors"
    >
      <Link2 className="w-3.5 h-3.5" />
      {copied ? "Link copied" : "Share"}
    </button>
  );
};

export default ShareButton;
