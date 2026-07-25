# Roadmap & Status

A zoomable canvas of branching LLM chat threads: diverge by branching/fan-out,
interrogate in parallel with broadcast, converge with merge nodes.

## Done

### Phase 0 — MVP canvas + chat
- [x] Zoomable/pannable infinite canvas (React Flow) with rectangles as chat threads
- [x] Chat UI per node: message list, input, Enter-to-send, typing indicator
- [x] Branch from any assistant message → new linked node inheriting context up to that message
- [x] Overlap-free auto-placement, directional arrows, minimap, zoom controls
- [x] Mock LLM isolated behind an `LLMClient` interface (`src/lib/mockLLM.ts`) so a real API is a one-file swap
- [x] localStorage persistence with corrupted-data fallback

### Phase 1 — legibility + daily use
- [x] List view (`src/components/ListView.tsx`): sortable table — depth, title, lineage,
      branch-point excerpt, message count, last activity, status — click a row to focus on canvas
- [x] Status tags (open / promising / dead-end / chosen) driving node border colours
- [x] Rename inline (node header + list); delete with children re-attaching to the parent; root undeletable
- [x] Markdown + fenced-code rendering, copy button, Cmd/Ctrl+B branch-from-last-reply, Esc
- [x] Bug fix: a failed reply no longer bricks a thread (missing `.catch` + persisted stuck
      `isGeneratingReply`); failures surface inline with Retry
- [x] Persistence v2 with a real migration

### Phase 2 — divergence at scale
- [x] Varied mock replies (seeded `variantHint` so concurrent siblings differ)
- [x] Fan-out ⤷×3: regenerate one assistant reply three different ways as sibling threads
- [x] Broadcast: one question sent to K selected threads in parallel (list-view checkboxes)
- [x] Compare panel: the K answers side-by-side, focus/retry per column

### Phase 3 — convergence
- [x] Multi-parent threads (`parentThreadIds`), longest-path depth with cycle guard
- [x] Merge nodes (⑂ badge): synthesis prompt built from each source's tail message, immediate reply
- [x] Generalized delete: a deleted node's children adopt all of its parents (covers merge deletion)
- [x] Reference edges: dashed, drag-to-draw between handles, own ✕ delete button;
      branch edges are structural and non-deletable
- [x] Persistence v3 with migration from v1/v2

## Next up (Phase 4 — annotation & distillation)
- [ ] Editable edge labels on the canvas — record *why* a branch was taken
- [ ] Opt-in per-thread gist (button, result cached on the thread)

## Displaced (moved, not dropped)

| Item | Where it went | Why |
|---|---|---|
| Semantic zoom / map-level titles | Dropped from near-term | Not a current concern; the list view covers "see the gist" |
| Distill-to-document | Later (post-Phase 4) | Rated "somewhat interesting" |
| NotebookLM-style source library | Phase 5, deliberate fork | Forces IndexedDB + retrieval + likely real LLM — a foundation change |
| Edit-and-resend / regenerate-as-branch unification | Undecided | Needs a decision before Phase 5; messages currently can't be edited or regenerated in place |

## Missing for the whole to work (known gaps & debts)

Ordered by how hard they'd bite:

1. **Storage ceiling.** localStorage tops out at ~5–10 MB and the entire tree is re-serialized
   on every debounced change. Quota overflow is loudly logged but the change is still lost.
   Real LLM responses — and certainly sources — need IndexedDB.
2. **No real LLM.** Everything is mocked. The `LLMClient` seam is ready, but real integration
   brings three things at once: a small proxy backend (API keys can't live in browser code),
   streaming (token-by-token append changes the store's action shape — design before swapping),
   and cancellation via AbortController.
3. **No committed tests.** Phases were verified with throwaway Playwright scripts (28/19/33
   checks) that were deleted after running. Nothing repeatable guards `computeBranchPosition`,
   the context-slice logic, or the v1→v2→v3 migrations — the places a regression silently
   corrupts saved data. Wanted: Vitest for the pure functions + one committed Playwright smoke.
4. **Stale layout after delete.** Re-parented children keep their old column position, leaving
   long elbow edges. Positions are deliberately stable (manual drags win), so the fix is an
   explicit re-tidy / auto-layout action — not yet built.
5. **Performance ceiling.** Every node mounts a full live chat component with its own textarea;
   ~50+ nodes will get heavy. Semantic zoom or render-light-below-a-zoom-threshold would fix it.
6. **No export / backup / reset.** Migration discards data it can't parse; there is no
   export-to-JSON, no import, and no "new workspace" button (fresh start = clear localStorage
   in devtools).
7. **No undo.** Delete is irreversible — children survive, the deleted thread's content doesn't.
8. **Thin merge context.** A merge node inherits only each source's last message by design, so
   follow-ups inside it have shallow grounding. Revisit alongside real LLM.
9. **Fixture generator never built.** The planned 40-node seed for judging layout/legibility/perf
   at scale doesn't exist; all testing has been on hand-made trees.
10. Minor: viewport (pan/zoom) not persisted across reloads; copy button silently no-ops in
    non-secure (non-HTTPS) contexts.
