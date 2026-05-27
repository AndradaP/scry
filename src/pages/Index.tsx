import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Footer from "@/components/Footer";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const FIRE_GRADIENT_OUTER = "radial-gradient(ellipse at 50% 0%, #D4A843 0%, #C4581A 45%, transparent 75%)";
const FIRE_GRADIENT_INNER = "radial-gradient(ellipse at 50% 0%, #FFD264 0%, #D4A843 30%, #C4581A 65%, transparent 85%)";
const COAL_GRADIENT = "linear-gradient(90deg, transparent 0%, rgba(196,88,26,0.4) 20%, rgba(212,168,67,0.9) 40%, rgba(255,210,100,1) 50%, rgba(212,168,67,0.9) 60%, rgba(196,88,26,0.4) 80%, transparent 100%)";

const Index = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hoverCard, setHoverCard] = useState<"generate" | "critique" | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const go = (path: string) => navigate(isLoggedIn ? path : "/login");

  return (
    <AppLayout>
      {/* Hero — fills remaining viewport height */}
      <div className="flex-1 relative flex flex-col overflow-hidden">

        {/* Fire shadow — outer (z-index 0, behind everything) */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "500px",
            height: "320px",
            background: FIRE_GRADIENT_OUTER,
            clipPath: "polygon(50% 0%, 96% 100%, 4% 100%)",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        {/* Fire shadow — inner (z-index 0) */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "240px",
            height: "240px",
            background: FIRE_GRADIENT_INNER,
            clipPath: "polygon(50% 0%, 88% 100%, 12% 100%)",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        {/* Centered content — flex-1 pushes footer to bottom */}
        <div
          className="flex-1 flex flex-col items-center justify-center"
          style={{ position: "relative", zIndex: 2, padding: "0 24px" }}
        >
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 600,
              fontSize: "52px",
              color: "#F0EBE0",
              marginBottom: "12px",
              lineHeight: 1.1,
            }}
          >
            Scry
          </h1>

          <p
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: "14px",
              color: "#A09A92",
              marginBottom: "48px",
            }}
          >
            Product teardowns powered by the best product minds.
          </p>

          {/* Mode cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              maxWidth: "560px",
              width: "100%",
            }}
          >
            {/* Generate */}
            <button
              onClick={() => go("/generate")}
              onMouseEnter={() => setHoverCard("generate")}
              onMouseLeave={() => setHoverCard(null)}
              onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              style={{
                border: `1px solid ${hoverCard === "generate" ? "rgba(212,168,67,0.75)" : "rgba(212,168,67,0.45)"}`,
                background: hoverCard === "generate" ? "rgba(212,168,67,0.04)" : "transparent",
                padding: "24px",
                textAlign: "left",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
                borderRadius: 0,
              }}
            >
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontWeight: 600,
                  fontSize: "18px",
                  color: "#D4A843",
                  marginBottom: "8px",
                }}
              >
                Generate a Teardown
              </h2>
              <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "13px", color: "#A09A92", margin: 0 }}>
                Pick a product. Get a full-stack analysis.
              </p>
            </button>

            {/* Critique */}
            <button
              onClick={() => go("/critique")}
              onMouseEnter={() => setHoverCard("critique")}
              onMouseLeave={() => setHoverCard(null)}
              onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              style={{
                border: `1px solid ${hoverCard === "critique" ? "rgba(240,235,224,0.3)" : "rgba(240,235,224,0.15)"}`,
                background: hoverCard === "critique" ? "rgba(240,235,224,0.03)" : "transparent",
                padding: "24px",
                textAlign: "left",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
                borderRadius: 0,
              }}
            >
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontWeight: 600,
                  fontSize: "18px",
                  color: "#F0EBE0",
                  marginBottom: "8px",
                }}
              >
                Critique My Teardown
              </h2>
              <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "13px", color: "#A09A92", margin: 0 }}>
                Submit your analysis. Get expert feedback.
              </p>
            </button>
          </div>
        </div>

        {/* Footer — sits at bottom of hero, above coal line */}
        <Footer />

        {/* Coal line */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "1px",
            background: COAL_GRADIENT,
            zIndex: 4,
            pointerEvents: "none",
          }}
        />
      </div>
    </AppLayout>
  );
};

export default Index;
