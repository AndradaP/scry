import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import HistorySidebar from "@/components/HistorySidebar";
import Footer from "@/components/Footer";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const FIRE_GRADIENT_OUTER = "radial-gradient(ellipse at 50% 55%, rgba(212,168,67,0.22) 0%, rgba(196,88,26,0.10) 35%, rgba(196,88,26,0.03) 62%, transparent 80%)";
const FIRE_GRADIENT_INNER = "radial-gradient(ellipse at 50% 37%, rgba(255,210,100,0.16) 0%, rgba(212,168,67,0.06) 30%, transparent 58%)";
const COAL_GRADIENT = "linear-gradient(90deg, transparent 0%, rgba(196,88,26,0.4) 20%, rgba(212,168,67,0.9) 40%, rgba(255,210,100,1) 50%, rgba(212,168,67,0.9) 60%, rgba(196,88,26,0.4) 80%, transparent 100%)";

const Index = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
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
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "100dvh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "hsl(var(--background))",
      }}
    >
      <Header onToggleSidebar={isLoggedIn ? () => setSidebarOpen(!sidebarOpen) : undefined} />

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {isLoggedIn && (
          <HistorySidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

          {/* Hero — fills remaining height above footer */}
          <div
            style={{
              flex: 1,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            {/* Fire shadow — outer triangle, base on coal line, tip toward wordmark */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: "800px",
                height: "700px",
                background: FIRE_GRADIENT_OUTER,
                zIndex: 0,
                pointerEvents: "none",
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: "450px",
                height: "500px",
                background: FIRE_GRADIENT_INNER,
                zIndex: 0,
                pointerEvents: "none",
              }}
            />

            {/* Content — vertically centered */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                zIndex: 2,
                padding: "0 24px",
              }}
            >
              <h1
                className="text-[52px] lg:text-[72px]"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontWeight: 600,
                  color: "#F0EBE0",
                  marginBottom: "16px",
                  lineHeight: 1.1,
                }}
              >
                Scry
              </h1>

              <p
                className="mb-8 lg:mb-14"
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: "18px",
                  color: "#A09A92",
                  textAlign: "center",
                }}
              >
                Product teardowns powered by the best product minds.
              </p>

              <div
                className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full"
                style={{ maxWidth: "680px" }}
              >
                <button
                  onClick={() => go("/generate")}
                  onMouseEnter={() => setHoverCard("generate")}
                  onMouseLeave={() => setHoverCard(null)}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  style={{
                    border: `1px solid ${hoverCard === "generate" ? "rgba(212,168,67,0.75)" : "rgba(212,168,67,0.45)"}`,
                    background: hoverCard === "generate" ? "rgba(212,168,67,0.04)" : "transparent",
                    padding: "32px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                    borderRadius: 0,
                  }}
                >
                  <h2
                    className="text-2xl"
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontWeight: 600,
                      color: "#D4A843",
                      marginBottom: "24px",
                    }}
                  >
                    Generate a Teardown
                  </h2>
                  <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "14px", color: "#A09A92", margin: 0 }}>
                    Pick a product. Get a full-stack analysis.
                  </p>
                </button>

                <button
                  onClick={() => go("/critique")}
                  onMouseEnter={() => setHoverCard("critique")}
                  onMouseLeave={() => setHoverCard(null)}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  style={{
                    border: `1px solid ${hoverCard === "critique" ? "rgba(240,235,224,0.3)" : "rgba(240,235,224,0.15)"}`,
                    background: hoverCard === "critique" ? "rgba(240,235,224,0.03)" : "transparent",
                    padding: "32px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                    borderRadius: 0,
                  }}
                >
                  <h2
                    className="text-2xl"
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontWeight: 600,
                      color: "#F0EBE0",
                      marginBottom: "24px",
                    }}
                  >
                    Critique My Teardown
                  </h2>
                  <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "14px", color: "#A09A92", margin: 0 }}>
                    Submit your analysis. Get expert feedback.
                  </p>
                </button>
              </div>
            </div>

            {/* Coal line — last child of hero, in normal flow */}
            <div
              aria-hidden="true"
              style={{
                height: "1px",
                flexShrink: 0,
                background: COAL_GRADIENT,
              }}
            />
          </div>

          {/* Footer — sibling of hero, below coal line */}
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default Index;
