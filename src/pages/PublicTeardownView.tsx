import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import SectionDisplay from "@/components/SectionDisplay";

interface TeardownData {
  product_name: string;
  mode: "generate" | "critique";
  sections: { key: string; label: string; content: string }[];
}

const PublicTeardownView = () => {
  const { id } = useParams<{ id: string }>();
  const [teardown, setTeardown] = useState<TeardownData | null>(null);
  const [status, setStatus] = useState<"loading" | "found" | "not-found">("loading");

  useEffect(() => {
    const fetchTeardown = async () => {
      const { data, error } = await supabase
        .from("teardowns")
        .select("product_name, mode, output, is_public")
        .eq("id", id)
        .single();

      if (error || !data || !data.is_public) {
        setStatus("not-found");
        return;
      }

      setTeardown({
        product_name: data.product_name,
        mode: data.mode,
        sections: data.output?.sections ?? [],
      });
      setStatus("found");
    };

    if (id) fetchTeardown();
  }, [id]);

  if (status === "loading") {
    return <div style={{ background: "#0A0A08", minHeight: "100dvh" }} />;
  }

  if (status === "not-found") {
    return (
      <div
        style={{ background: "#0A0A08", minHeight: "100dvh" }}
        className="flex items-center justify-center"
      >
        <p className="font-body text-sm" style={{ color: "#7A7670" }}>
          This teardown is not available.
        </p>
      </div>
    );
  }

  const modeLabel = teardown!.mode === "generate" ? "Generated" : "Critique";

  return (
    <div style={{ background: "#0A0A08", minHeight: "100dvh" }}>
      <div className="w-full max-w-[860px] mx-auto px-6 py-12">
        <div className="mb-10">
          <Link
            to="/"
            className="font-body text-sm underline hover:opacity-70 transition-opacity"
            style={{ color: "#D4A843" }}
          >
            Analyzed with Scry
          </Link>
        </div>
        <div className="mb-10">
          <h1
            className="font-heading text-4xl md:text-5xl font-semibold"
            style={{ color: "#F0EBE0" }}
          >
            {teardown!.product_name}
          </h1>
          <span
            className="inline-block mt-2 font-mono uppercase tracking-[0.15em]"
            style={{ fontSize: "11px", color: "#7A7670" }}
          >
            {modeLabel}
          </span>
        </div>
        <SectionDisplay sections={teardown!.sections} />
      </div>
    </div>
  );
};

export default PublicTeardownView;
