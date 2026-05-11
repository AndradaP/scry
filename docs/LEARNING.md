# The Shard — Learning Log

A running list of topics, tools, and concepts to explore in more depth.
Triggered during build sessions with \learning — revisited when time allows.

---

## 1. SQL — The Database Setup Script
**Context:** Used to create the `teardowns` and `messages` tables in Supabase.
**Topics to cover:**
- What each clause means: `create table`, `primary key`, `references`, `on delete cascade`
- Data types used: `uuid`, `text`, `jsonb`, `timestamptz`
- What `check` constraints do (e.g. `check (mode in ('generate', 'critique'))`)
- What `default gen_random_uuid()` means and why we use UUIDs instead of regular IDs
- Row Level Security (RLS): what it is, why it matters, how the policies work
- What `auth.uid()` is and how Supabase uses it to identify the current user
- The `vector` extension: what it is, why we enabled it, how it powers the RAG pipeline later

---

## 2. PATH — Mac Terminal Environment Variable
**Context:** Came up when installing Homebrew — needed to add Homebrew to PATH so the terminal could find the `brew` command.
**Topics to cover:**
- What PATH is and how the Mac uses it to find programs
- The difference between `.zprofile` and `.zshrc`
- What `eval` does in a shell command
- How environment variables work generally

---

## 3. npm — Node Package Manager
**Context:** Used to install project dependencies (`npm install`) and run the app locally (`npm run dev`).
**Topics to cover:**
- What npm is and how it relates to Node.js
- What `package.json` is and what it contains
- What `package-lock.json` is and why it changes on install
- What `node_modules` is and why it's never committed to GitHub
- Common npm commands: install, run, audit

---

## 4. pgvector — Vector Database Extension
**Context:** Enabled in Supabase via `create extension if not exists vector` — will power the RAG pipeline in Phase 2.
**Topics to cover:**
- What a vector is in the context of AI/ML
- How text gets converted into vectors (embeddings)
- What semantic similarity means and why it's more powerful than keyword search
- How pgvector fits into the RAG pipeline for The Shard
- Why we're using pgvector inside Supabase instead of a separate vector DB like Pinecone

---

## 5. Git & GitHub — Version Control Basics
**Context:** Cloning the repo, `.gitignore`, the orange M (modified) indicator in Cursor.
**Topics to cover:**
- What git is and what version control means
- The basic git workflow: edit → stage → commit → push
- What `.gitignore` does and why some files should never be committed
- What the M, A, D indicators mean in Cursor's file tree
- Branches: what they are and when we'll need them

---

## 6. Environment Variables & `.env.local`
**Context:** Created `.env.local` to store Supabase URL and API key securely.
**Topics to cover:**
- What environment variables are and why we use them
- Why secrets should never be hardcoded in source code
- The difference between `.env`, `.env.local`, `.env.production`
- What `VITE_` prefix means and why it's required for this project
- Why `.env.local` must be in `.gitignore`
## 7. React Fundamentals — How The Shard Is Built
**Context:** Learning session covering the structure, logic, and language of the frontend codebase.
**Status:** Covered at a high level — good foundation established.

### TSX
- TypeScript + JSX — lets you write HTML-like syntax directly inside JavaScript/TypeScript files
- TS adds types to JS (catches bugs before they happen); JSX adds HTML syntax; TSX = both together
- React converts TSX to real HTML when the app runs in the browser

### The app tree mental model
- React apps are trees of components — big frames made of smaller frames (like Figma)
- `App.tsx` is the root; it defines routes; routes render pages; pages use components; components use smaller components
- Reference: `docs/the-shard-app-tree.jsx` — interactive diagram of The Shard's full tree

### Pages vs Components
- Pages live in `src/pages/` — each file is one screen, shown by the router at a specific URL
- Components live in `src/components/` — reusable building blocks used across multiple pages
- Utilities live in `src/lib/` — non-UI logic like the Supabase client and history helpers

### Routing — React Router
- Traditional websites load a new HTML file for each URL
- React apps have one HTML file; React Router intercepts URL changes and swaps which component renders
- This is called a Single Page Application (SPA) — no page reloads, instant navigation
- Routes are defined in `App.tsx`: `<Route path="/generate" element={<Generate />} />`

### `const` — variable declaration
- `const` creates a variable that cannot be reassigned (always points to the same thing)
- Use `let` when you need to reassign; use `const` for almost everything in React
- "Constant" means the pointer doesn't change, not that the value inside can't change

### `useState` — state initialization and management
- Pattern: `const [variable, setVariable] = useState(initialValue)`
- `variable` = current value; `setVariable` = function to update it; `initialValue` = starting value
- When you call `setVariable(newValue)`, React re-renders the component automatically
- Regular variables don't trigger re-renders — that's why we use useState

### Props — passing data between components
- Props are arguments passed into a component from its parent
- Example: `<Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />`
- `onToggleSidebar` is the prop name; the arrow function is the value
- Props flow DOWN (parent to child); events flow UP (child calls a function the parent passed down)
- TypeScript `interface` defines what props a component accepts

### Events vs Effects — the two on-ramps to state change
- **Event** — user action triggers it (click, type, submit) → calls setState → re-render
- **Effect** — app lifecycle triggers it (component loads, dependency changes) → calls setState → re-render
- Both feed state; state feeds the UI
- Key insight: "Effects exist to synchronize state with the outside world (Supabase, APIs, browser). Events exist to respond to the user."
- `useEffect(() => { ... }, [])` — the `[]` means run once on load; `[someVar]` means run when someVar changes

### How to find things in the codebase
- Wrong text on landing page → `src/pages/index.tsx`
- Wrong text in header → `src/components/Header.tsx`
- Layout broken everywhere → `src/components/AppLayout.tsx`
- Supabase not connecting → `src/lib/supabase.ts`
- Routing wrong → `src/App.tsx`
- Search across all files: Cmd+Shift+F in Cursor

---

## 8. Google Sign-In / OAuth
**Context:** Mentioned as a nice-to-have for login.
**Topics to cover:**
- What OAuth is and how it differs from email/password auth
- How Supabase handles Google sign-in (one toggle in dashboard + client code)
- What happens to existing email/password users when OAuth is added
- When to add this (after core app is working, not before)

---

## 9. Browser Developer Tools
**Context:** Used to debug the Supabase connection issue — console, network tab, elements inspector.
**Topics to cover:**
- Console tab: what it shows, how to read errors vs warnings
- Network tab: how to see requests being sent to external services like Supabase
- Elements tab: inspecting the DOM, finding what's selected
- How to open dev tools on Mac (View → Developer, or Cmd+Option+I when it works)

---

*Add new entries with \learning during build sessions.*
