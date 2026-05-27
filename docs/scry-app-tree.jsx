import { useState } from "react";

const nodes = {
  app: {
    id: "app", label: "App.tsx", sub: "Root — defines all routes",
    color: "#7F77DD", textColor: "#EEEDFE",
    detail: "App.tsx is the root of the entire application. It uses React Router to define which page component gets shown for each URL. It's the only file that knows about URLs — everything else is unaware of routing.",
  },
  appLayout: {
    id: "appLayout", label: "AppLayout.tsx", sub: "Wraps every page",
    color: "#1D9E75", textColor: "#E1F5EE",
    detail: "AppLayout is the shared frame around every page. It renders the Header, the HistorySidebar, the page content (whatever page the router chose), and the Footer. Change it once and it changes everywhere.",
  },
  header: {
    id: "header", label: "Header.tsx", sub: "Logo, auth, sidebar toggle",
    color: "#888780", textColor: "#F1EFE8",
    detail: "Header manages the top bar. It checks the Supabase auth session with useEffect on load, stores the result in useState (userEmail), and shows either the user's email + sign out, or a sign in link. Props flow down from AppLayout to pass the sidebar toggle function.",
  },
  pageContent: {
    id: "pageContent", label: "Page content", sub: "Swapped by React Router",
    color: "#1D9E75", textColor: "#E1F5EE",
    detail: "This slot is where React Router renders the active page. When the URL is /generate, the Generate component renders here. When it's /login, the Login component renders. Only one page is shown at a time.",
  },
  footer: {
    id: "footer", label: "Footer.tsx", sub: "Powered by Lenny",
    color: "#888780", textColor: "#F1EFE8",
    detail: "Footer is a simple presentational component — no state, no effects. It just renders the wordmark and the Powered by Lenny's Podcast & Newsletter link on every page.",
  },
  index: {
    id: "index", label: "index.tsx", sub: "Landing page",
    color: "#BA7517", textColor: "#FAEEDA",
    detail: "The landing page. Uses useState to track isLoggedIn (checked via useEffect on mount). If logged in, clicking a card navigates to /generate or /critique. If not, it redirects to /login. Logged-out users still see the page — they just can't enter the app.",
  },
  generate: {
    id: "generate", label: "generate.tsx", sub: "Teardown flow",
    color: "#BA7517", textColor: "#FAEEDA",
    detail: "The Generate page manages the full teardown flow: input → loading state → teardown output → chat. Uses multiple useState hooks for productName, isLoading, teardown output, and chat messages. Currently uses mock AI responses — Phase 2 wires in real Claude API calls.",
  },
  critique: {
    id: "critique", label: "critique.tsx", sub: "Critique flow",
    color: "#BA7517", textColor: "#FAEEDA",
    detail: "The Critique page manages the critique flow: write/upload input → loading → critique output → chat. Same pattern as Generate but with different sections and a file upload tab. Currently uses mock responses.",
  },
  login: {
    id: "login", label: "login.tsx", sub: "Sign in",
    color: "#5F5E5A", textColor: "#F1EFE8",
    detail: "Login page calls supabase.auth.signInWithPassword() with the email and password from state. On success, redirects to /. On error, shows an alert. The handleSubmit function is async — it waits for Supabase to respond before doing anything.",
  },
  signup: {
    id: "signup", label: "signup.tsx", sub: "Create account",
    color: "#5F5E5A", textColor: "#F1EFE8",
    detail: "Signup page calls supabase.auth.signUp(). On success, shows a confirmation message and redirects to /login. Same async pattern as login. Email confirmation is currently disabled in Supabase settings for easier development.",
  },
  historySidebar: {
    id: "historySidebar", label: "HistorySidebar.tsx", sub: "Past teardowns list",
    color: "#D85A30", textColor: "#FAECE7",
    detail: "HistorySidebar reads teardown history and renders the list with filter tabs (All / Generated / Critiques) and a search input. Currently reads from localStorage via history.ts. Phase 2 will replace this with real Supabase DB queries. Only shown to logged-in users.",
  },
  chatPanel: {
    id: "chatPanel", label: "ChatPanel.tsx", sub: "Q&A below teardown",
    color: "#D85A30", textColor: "#FAECE7",
    detail: "ChatPanel is a reusable component used in both Generate and Critique modes. It manages a scrollable message thread and a text input. Currently returns mock responses. Phase 2 wires it to real Claude API calls with the teardown as context.",
  },
  sectionDisplay: {
    id: "sectionDisplay", label: "SectionDisplay.tsx", sub: "Collapsible sections",
    color: "#D85A30", textColor: "#FAECE7",
    detail: "SectionDisplay renders the labeled, collapsible sections of a teardown or critique. It's shared between both modes — the only difference is the section labels passed in as props. Each section has a toggle to expand or collapse it.",
  },
  supabase: {
    id: "supabase", label: "supabase.ts", sub: "DB + auth connection",
    color: "#185FA5", textColor: "#E6F1FB",
    detail: "supabase.ts creates and exports a single Supabase client instance using your project URL and publishable key from .env.local. Every component that needs to talk to the database or auth imports { supabase } from here. It lives in src/lib because it's not a UI component — it's a utility.",
  },
  history: {
    id: "history", label: "history.ts", sub: "localStorage helpers",
    color: "#185FA5", textColor: "#E6F1FB",
    detail: "history.ts contains helper functions for reading and writing teardown history to localStorage (getHistory, saveEntry, getEntry). This is the Phase 1 approach — Phase 2 will replace localStorage with real Supabase database queries so history persists across devices.",
  },
};

const layers = [
  { label: "Router", ids: ["app"] },
  { label: "Layout shell", ids: ["appLayout"] },
  { label: "Layout children", ids: ["header", "pageContent", "footer"] },
  { label: "Pages", ids: ["index", "generate", "critique", "login", "signup"] },
  { label: "Shared components", ids: ["historySidebar", "chatPanel", "sectionDisplay"] },
  { label: "Utilities (src/lib)", ids: ["supabase", "history"] },
];

function Node({ node, selected, onClick }) {
  return (
    <button
      onClick={() => onClick(node.id)}
      style={{
        background: node.color,
        border: selected ? "2px solid white" : "1.5px solid transparent",
        borderRadius: 6,
        padding: "8px 14px",
        cursor: "pointer",
        textAlign: "left",
        outline: "none",
        opacity: selected ? 1 : 0.88,
        transition: "opacity 0.15s, border 0.15s",
        minWidth: 120,
        flex: "1 1 auto",
        maxWidth: 180,
      }}
    >
      <div style={{ color: node.textColor, fontWeight: 500, fontSize: 13, lineHeight: 1.3 }}>{node.label}</div>
      <div style={{ color: node.textColor, opacity: 0.7, fontSize: 11, marginTop: 2 }}>{node.sub}</div>
    </button>
  );
}

export default function AppTree() {
  const [selected, setSelected] = useState(null);

  const handleClick = (id) => {
    setSelected(selected === id ? null : id);
  };

  const selectedNode = selected ? nodes[selected] : null;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "16px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {layers.map((layer, li) => (
          <div key={layer.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {li > 0 && (
              <div style={{ width: 1, height: 18, background: "var(--color-border-secondary, #ccc)", margin: "0 auto" }} />
            )}
            <div style={{ width: "100%", marginBottom: 4 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 500,
                color: "var(--color-text-tertiary, #999)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
                paddingLeft: 2,
              }}>
                {layer.label}
              </div>
              <div style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: layer.ids.length === 1 ? "center" : "flex-start",
              }}>
                {layer.ids.map(id => (
                  <Node
                    key={id}
                    node={nodes[id]}
                    selected={selected === id}
                    onClick={handleClick}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedNode && (
        <div style={{
          marginTop: 20,
          padding: "14px 16px",
          borderRadius: 8,
          background: "var(--color-background-secondary, #f5f5f5)",
          borderLeft: `4px solid ${selectedNode.color}`,
        }}>
          <div style={{
            fontWeight: 500,
            fontSize: 14,
            color: "var(--color-text-primary, #111)",
            marginBottom: 6,
          }}>
            {selectedNode.label}
          </div>
          <div style={{
            fontSize: 13,
            color: "var(--color-text-secondary, #555)",
            lineHeight: 1.6,
          }}>
            {selectedNode.detail}
          </div>
          <button
            onClick={() => setSelected(null)}
            style={{
              marginTop: 10,
              fontSize: 11,
              color: "var(--color-text-tertiary, #999)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            close
          </button>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 11, color: "var(--color-text-tertiary, #aaa)" }}>
        Click any node to learn what it does.
      </div>
    </div>
  );
}
