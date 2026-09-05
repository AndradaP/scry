---
name: learn
description: Capture a teaching explanation (a concept, bias, technique, or tool that just came up) into this project's persistent learning log and a readable companion artifact, for the user to reread later. Use when the user asks to save/retain an explanation, says "teach me", asks to learn as they build, or invokes /learn.
---

# /learn — capture a teaching moment into the project's learning log

## When this runs

The user wants something just explained (or several things from the recent
conversation) captured somewhere durable and readable, not left to scroll
away in chat history. Triggered by `/learn`, or requests like "I want to
retain this," "teach me and save it," "add this to the learning log," "I
want to learn as we code."

## What to do, each time

1. **Identify the content.** Look back over the current conversation for
   the concept(s), technique(s), or decision(s) that were just taught or
   discussed in enough depth to be worth keeping — not everything said in
   the conversation, just the substantive teaching content. If the user
   names a specific topic (`/learn position bias`), scope to that instead
   of the whole conversation.

2. **Write real content into `docs/LEARNING.md`**, not a placeholder. That
   file has an established convention already: numbered `## N. Topic —
   Title` sections, a **Context** line naming what prompted it, then
   content. Append new sections in that style — don't renumber or rewrite
   existing ones. Unlike the file's older entries (which are "topics to
   cover" reminders for a later session), sections added by this skill
   should contain the actual explanation: definitions, the reasoning behind
   them, and — this part matters — tied to *this* project's real specifics
   (Scry, the Lenny archive, the eval pipeline, whatever's actually true of
   this codebase) rather than generic textbook filler. This is a log of
   things that came up while building Scry, not a general reference
   encyclopedia.

3. **Add a diagram where one would genuinely clarify something** — a
   pipeline with stages, two architectures compared side by side, a
   decision flow — using a Mermaid code fence (` ```mermaid `). Skip it for
   concepts with no real shape to draw; a forced diagram on a purely verbal
   idea is worse than no diagram.

4. **Publish or update the companion artifact**, which renders the current
   full state of `docs/LEARNING.md` as a clean, readable page (not a raw
   markdown dump — proper hierarchy, comfortable reading width, light/dark
   aware, Mermaid diagrams rendered). Steps:
   - Load the `artifact-design` skill before writing it (and
     `artifact-diagramming` if a diagram from step 3 needs more than a
     plain Mermaid render).
   - The local HTML source lives at `docs/learning-notes-artifact.html`,
     checked into the repo (not the session scratchpad — this needs to
     survive across sessions). Read it if it exists; regenerate its content
     in full from the current `docs/LEARNING.md` each time rather than
     hand-patching it, since the log file is the source of truth.
   - The first line of that HTML file, once published, should be an HTML
     comment recording the live URL: `<!-- learning-notes-artifact-url:
     https://... -->`. On every run after the first, read that comment to
     get the URL and pass it as `url` to the `Artifact` tool so this
     updates the same page instead of creating a new one — do not guess or
     re-derive the URL any other way.

5. **Tell the user** what section was added and the artifact URL. Keep this
   short — the artifact itself is where the actual reading happens.

## Ground rules

- Never fabricate the substance of what was supposedly just taught — if
  it's unclear what to capture, ask rather than invent content the user
  didn't actually see.
- `docs/LEARNING.md` is the source of truth (git-tracked, durable, diffable
  history of what's been explained). The artifact is a reading layer
  regenerated from it every time, never a separately hand-maintained thing.
- Match the existing file's tone: plain, direct, no marketing language, no
  padding for its own sake.
