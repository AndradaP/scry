import { useState, useEffect, useRef } from "react";

interface LoadingStateProps {
  messages: string[];
}

const LoadingState = ({ messages }: LoadingStateProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasPointer, setHasPointer] = useState(false);
  const [glowReady, setGlowReady] = useState(false);
  const glowRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const glowReadyRef = useRef(false);

  useEffect(() => {
    setHasPointer(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= messages.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [messages.length]);

  useEffect(() => {
    if (!hasPointer) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        glowRef.current?.style.setProperty("--mx", `${e.clientX}px`);
        glowRef.current?.style.setProperty("--my", `${e.clientY}px`);
        if (!glowReadyRef.current) {
          glowReadyRef.current = true;
          setGlowReady(true);
        }
        rafRef.current = null;
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [hasPointer]);

  return (
    <div style={{ position: "relative" }}>
      {/* Cursor-tracking amber glow — hidden until first mouse position is known */}
      {hasPointer && (
        <div
          ref={glowRef}
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            background: "radial-gradient(circle 300px at var(--mx, 50%) var(--my, 50%), rgba(212,168,67,0.20) 0%, rgba(196,88,26,0.10) 45%, transparent 70%)",
            opacity: glowReady ? 1 : 0,
            transition: "opacity 0.7s ease",
          }}
        />
      )}

      {/* Film grain — sits above glow, below text */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          opacity: 0.045,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "180px 180px",
        }}
      />

      {/* Content */}
      <div className="py-20" style={{ position: "relative", zIndex: 2 }}>
        <div className="h-0.5 bg-border overflow-hidden mb-12">
          <div
            className="h-full bg-primary w-full origin-left"
            style={{ animation: "loading-bar 8s ease-in-out infinite" }}
          />
        </div>
        <p className="font-body text-sm text-muted-foreground text-center transition-opacity duration-300">
          {messages[currentIndex]}
        </p>
        <p
          style={{
            fontFamily: "'DM Mono', 'Courier New', monospace",
            fontSize: "11px",
            color: "#8A857E",
            letterSpacing: "0.05em",
            textAlign: "center",
            maxWidth: "480px",
            margin: "16px auto 0",
          }}
        >
          /skraɪ/ — verb<br />to uncover hidden knowledge by gazing into a reflective surface
        </p>
        <style>{`
          @keyframes loading-bar {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default LoadingState;
