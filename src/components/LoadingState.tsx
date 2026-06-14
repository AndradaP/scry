import { useState, useEffect } from "react";

interface LoadingStateProps {
  messages: string[];
}

const LoadingState = ({ messages }: LoadingStateProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

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

  return (
    <div className="py-20">
      <div className="h-0.5 bg-border overflow-hidden mb-12">
        <div className="h-full bg-primary animate-pulse w-full origin-left" 
             style={{ animation: "loading-bar 8s ease-in-out infinite" }} />
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
          marginTop: "16px",
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
  );
};

export default LoadingState;
