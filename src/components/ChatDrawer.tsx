import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ChatPanel from "./ChatPanel";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatDrawerProps {
  messages: Message[];
  onSend: (message: string) => void;
  isLoading?: boolean;
  isStreaming?: boolean;
}

const ChatDrawer = ({ messages, onSend, isLoading, isStreaming }: ChatDrawerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="hidden lg:flex flex-col flex-shrink-0"
      style={{
        width: isOpen ? "340px" : "40px",
        transition: "width 0.2s ease",
        borderLeft: "1px solid hsl(var(--border))",
        background: "hsl(var(--background))",
        overflow: "hidden",
      }}
    >
      {isOpen ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              borderBottom: "1px solid hsl(var(--border))",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: "10px",
                color: "#D4A843",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Chat
            </span>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                color: "#7A7670",
              }}
            >
              <ChevronRight style={{ width: "16px", height: "16px" }} />
            </button>
          </div>
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <ChatPanel
              variant="panel"
              messages={messages}
              onSend={onSend}
              isLoading={isLoading}
              isStreaming={isStreaming}
            />
          </div>
        </>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: "24px",
            gap: "10px",
            background: "none",
            border: "none",
            cursor: "pointer",
            width: "100%",
          }}
        >
          <ChevronLeft style={{ width: "14px", height: "14px", color: "#D4A843" }} />
          <span
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: "10px",
              color: "#7A7670",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
            }}
          >
            Chat
          </span>
        </button>
      )}
    </div>
  );
};

export default ChatDrawer;
