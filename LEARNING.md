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

---

*Add new entries with \learning during build sessions.*
