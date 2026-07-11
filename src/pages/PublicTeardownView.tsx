import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import SectionDisplay from "@/components/SectionDisplay";

interface TeardownData {
  product_name: string;
  mode: "generate" | "critique";
  sections: { key: string; label: string; content: string }[];
}

const TIMEOUT_MS = 10_000;

const PublicTeardownView = () => {
  const { id } = useParams<{ id: string }>();
  const [teardown, setTeardown] = useState<TeardownData | null>(null);
  const [status, setStatus] = useState<"loading" | "found" | "not-found" | "timeout">("loading");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!id) return;

    setStatus("loading");

    const timer = setTimeout(() => setStatus("timeout"), TIMEOUT_MS);

    const fetchTeardown = async () => {
      const { data, error } = await supabase
        .from("teardowns")
        .select("product_name, mode, output, is_public")
        .eq("id", id)
        .single();

      clearTimeout(timer);

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

    fetchTeardown();

    return () => clearTimeout(timer);
  }, [id, retryKey]);

  if (status === "loading") {
    return (
      <div
        style={{
          background: "#0A0A08",
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
        }}
      >
        <span
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: "26px",
            fontWeight: 600,
            color: "#D4A843",
          }}
        >
          Scry
        </span>
        <div
          style={{
            width: "100px",
            height: "1px",
            background: "rgba(212,168,67,0.18)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#D4A843",
              animation: "scry-slide 1.4s ease-in-out infinite",
            }}
          />
        </div>
        <p
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "12px",
            color: "#7A7670",
            letterSpacing: "0.06em",
          }}
        >
          Loading teardown…
        </p>
        <style>{`
          @keyframes scry-slide {
            0%   { transform: translateX(-100%); }
            50%  { transform: translateX(0%);    }
            100% { transform: translateX(100%);  }
          }
        `}</style>
      </div>
    );
  }

  if (status === "timeout") {
    return (
      <div
        style={{
          background: "#0A0A08",
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
        }}
      >
        <p
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "14px",
            color: "#7A7670",
          }}
        >
          This is taking longer than expected.
        </p>
        <button
          onClick={() => setRetryKey((k) => k + 1)}
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "13px",
            color: "#D4A843",
            background: "none",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
          }}
        >
          Try again
        </button>
      </div>
    );
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

  const modeLabel = teardown!.mode === "generate" ? "Teardown" : "Critique";

  return (
    <div style={{ background: "#0A0A08", minHeight: "100dvh" }}>
      <div className="w-full max-w-[860px] mx-auto px-6 py-12">
        <div className="mb-10 flex justify-end">
          <Link
            to="/"
            className="font-body text-sm underline hover:opacity-70 transition-opacity"
            style={{ color: "#7A7670" }}
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
          <p className="mt-3 text-sm">
            <span className="font-mono uppercase tracking-[0.15em]" style={{ color: "#D4A843" }}>
              {modeLabel}
            </span>
            <span className="font-body" style={{ color: "#7A7670" }}>
              {teardown!.mode === "generate"
                ? ": AI-generated product teardown, drawn from Lenny Rachitsky's archive of 600+ interviews and newsletters."
                : ": AI critique of a product teardown, drawn from Lenny Rachitsky's archive of 600+ interviews and newsletters."}
            </span>
          </p>
        </div>
        <SectionDisplay sections={teardown!.sections} />
      </div>
    </div>
  );
};

export default PublicTeardownView;
