import { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  messages: Message[];
  onSend: (message: string) => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  variant?: "panel";
}

const renderWithCitations = (text: string): React.ReactNode[] => {
  const regex = /(\([^)]+?,\s*[^)]+?\))/g;
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <span key={i} style={{ fontStyle: "italic", fontSize: "13px", color: "#A09A92" }}>{part}</span>
      : <span key={i}>{part}</span>
  );
};

const ChatPanel = ({ messages, onSend, isLoading, isStreaming, variant }: ChatPanelProps) => {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isStreaming) return;
    onSend(input.trim());
    setInput("");
  };

  const messageList = messages.map((msg, index) => (
    <div
      key={msg.id}
      className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
    >
      {msg.role === "user" ? (
        <span
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "12px",
            color: "#7A7670",
            marginBottom: "6px",
          }}
        >
          You
        </span>
      ) : (
        <span
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "10px",
            color: "#D4A843",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: "6px",
          }}
        >
          Scry
        </span>
      )}
      {msg.role === "user" ? (
        <div
          style={{
            background: "#2E2C28",
            border: "1px solid #3E3C38",
            padding: "10px 14px",
            maxWidth: "75%",
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "14px",
            lineHeight: 1.6,
            color: "#F0EBE0",
            borderRadius: 0,
          }}
        >
          {msg.content}
        </div>
      ) : (
        <div
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "15px",
            lineHeight: 1.75,
            color: "#F0EBE0",
            width: "100%",
            overflowWrap: "break-word",
          }}
        >
          <ReactMarkdown
            components={{
              h1: ({ children }) => <p className="font-bold text-base mb-2">{children}</p>,
              h2: ({ children }) => <p className="font-bold mb-1 mt-3">{children}</p>,
              h3: ({ children }) => <p className="font-semibold mb-1 mt-2">{children}</p>,
              p: ({ children }) => (
                <p className="mb-2">
                  {Array.isArray(children)
                    ? children.flatMap((child, i) =>
                        typeof child === "string" ? renderWithCitations(child) : [child]
                      )
                    : typeof children === "string"
                    ? renderWithCitations(children)
                    : children}
                </p>
              ),
              ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
              strong: ({ children }) => <span className="font-semibold">{children}</span>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
          {isStreaming && index === messages.length - 1 && (
            <span
              className="animate-pulse"
              style={{
                display: "inline-block",
                width: "2px",
                height: "15px",
                background: "#D4A843",
                marginLeft: "2px",
                verticalAlign: "text-bottom",
              }}
            />
          )}
        </div>
      )}
    </div>
  ));

  const thinkingIndicator = isLoading ? (
    <div className="flex flex-col items-start">
      <span
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "10px",
          color: "#D4A843",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: "6px",
        }}
      >
        Scry
      </span>
      <span
        className="animate-pulse"
        style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "15px", color: "#7A7670" }}
      >
        Thinking…
      </span>
    </div>
  ) : null;

  const formContent = (
    <form onSubmit={handleSubmit} className="flex items-center gap-3" style={{ minWidth: 0 }}>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask about this teardown..."
        className="chat-input flex-1 bg-transparent border-b border-border focus:border-primary outline-none py-2 font-body transition-colors"
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "14px",
          color: "#F0EBE0",
          borderRadius: 0,
          minWidth: 0,
        }}
      />
      {/* Desktop: text send button */}
      <button
        type="submit"
        disabled={!input.trim() || isLoading || isStreaming}
        className="hidden lg:block"
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "13px",
          fontWeight: 500,
          color: "#D4A843",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "8px 0",
          opacity: !input.trim() || isLoading || isStreaming ? 0.3 : 1,
          transition: "opacity 0.15s",
          borderRadius: 0,
          flexShrink: 0,
        }}
      >
        Send
      </button>
      {/* Mobile: pill arrow button */}
      <button
        type="submit"
        disabled={!input.trim() || isLoading || isStreaming}
        className="lg:hidden flex items-center justify-center flex-shrink-0"
        style={{
          width: "52px",
          height: "36px",
          borderRadius: "18px",
          background: input.trim() && !isLoading && !isStreaming ? "#D4A843" : "#2E2C28",
          border: `1px solid ${input.trim() && !isLoading && !isStreaming ? "#D4A843" : "#3E3C38"}`,
          cursor: input.trim() && !isLoading && !isStreaming ? "pointer" : "default",
          transition: "background 0.15s, border-color 0.15s",
          padding: 0,
        }}
      >
        <ArrowUp
          style={{
            width: "16px",
            height: "16px",
            color: input.trim() && !isLoading && !isStreaming ? "#1A1815" : "#7A7670",
          }}
        />
      </button>
    </form>
  );

  if (variant === "panel") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="hidden lg:block" style={{ padding: "16px 20px 0", flexShrink: 0 }}>
          <p className="text-xs font-mono mb-4" style={{ color: "#7A7670" }}>
            Ask a follow-up <span className="opacity-50 ml-2">press /</span>
          </p>
        </div>
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: "auto", padding: "16px 20px 8px", minHeight: 0 }}
          className="space-y-6"
        >
          {messageList}
          {messages.length > 0 && thinkingIndicator}
        </div>
        <div className="chat-input-bar lg:border-t border-border" style={{ padding: "12px 20px", flexShrink: 0 }}>
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12 pt-8 border-t rule-amber">
      <p className="hidden lg:block text-xs font-mono mb-6" style={{ color: "#7A7670" }}>
        Ask a follow-up <span className="opacity-50 ml-2">press /</span>
      </p>
      {messages.length > 0 && (
        <div ref={scrollRef} className="max-h-[480px] overflow-y-auto mb-8 space-y-6" style={{ padding: "0 1.5rem" }}>
          {messageList}
          {thinkingIndicator}
        </div>
      )}
      {formContent}
    </div>
  );
};

export default ChatPanel;
