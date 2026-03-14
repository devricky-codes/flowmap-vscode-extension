# Plan: Graph-Based Entry Detection, Flow Partitioning & Sidebar Tabs

Replace heuristic entry-point detection with deterministic graph computation (in-degree=0, out-degree>0 excluding self-edges), rewrite flow partitioning to distinguish mini-flows from true orphans, and restructure the sidebar into three tabs.

---

### Phase 1 — Entry Point Detection (Core Logic)

1. **Rewrite `detectEntryPoints`** in [packages/core/src/graph/entryPointDetector.ts](packages/core/src/graph/entryPointDetector.ts)
   - New signature: `detectEntryPoints(nodes: FunctionNode[], edges: CallEdge[]): void`
   - Compute `calledIds` = set of `e.to` from edges where `e.from !== e.to` (excludes self-recursion)
   - Compute `callerIds` = set of `e.from` from edges where `e.from !== e.to`
   - For each node: `node.isEntryPoint = !calledIds.has(node.id) && callerIds.has(node.id)`
   - Delete all language/name/file-path heuristics

2. **Remove `isDefaultExport` from all language analyzers** (*parallel with step 1*)
   - [typescript.ts](packages/core/src/analyzer/languages/typescript.ts): delete `let isDefaultExport` (L74), the `export default` check (L79-80), change `isEntryPoint: isDefaultExport` (L144) → `isEntryPoint: false`
   - [javascript.ts](packages/core/src/analyzer/languages/javascript.ts): same at L71, L76-77, L138
   - [tsx.ts](packages/core/src/analyzer/languages/tsx.ts): same at L81, L86-87, L151
   - [jsx.ts](packages/core/src/analyzer/languages/jsx.ts): same at L78, L83-84, L145
   - Python and Go already set `false` — no change

3. **Update call order in `extension.ts`** (*depends on step 1*)
   - Three call sites (L83, L134, L217): move `detectEntryPoints(...)` AFTER `buildCallGraph(...)` and pass edges
   - Old: `detectEntryPoints(fns); const edges = buildCallGraph(fns, calls);`
   - New: `const edges = buildCallGraph(fns, calls); detectEntryPoints(fns, edges);`

---

### Phase 2 — Flow Partitioning (Core Logic)

4. **Add `orphans: string[]` to `Graph`** in [packages/core/src/types.ts](packages/core/src/types.ts)

5. **Rewrite `partitionFlows`** in [packages/core/src/graph/flowPartitioner.ts](packages/core/src/graph/flowPartitioner.ts) (*depends on step 1*)
   - New return type: `{ flows: Flow[], orphans: string[] }`
   - Extract helper `findEntryIds(nodeIds, edges)` — applies in-degree=0/out-degree>0 logic to a node subset
   - Algorithm:
     1. Find entry points from all nodes → BFS from each → create flows, mark visited
     2. Collect unvisited nodes → re-run `findEntryIds` on unvisited subgraph → BFS → mini-flows
     3. Repeat until no new entries found
     4. Remaining nodes **with edges** (pure cycles) → pick arbitrary node per connected component as synthetic entry → mini-flow
     5. Remaining nodes **with zero edges** → `orphans[]` (not rendered as flows)

6. **Update `extension.ts` graph construction** (*depends on step 5*)
   - Destructure: `const { flows, orphans } = partitionFlows(fns, edges);`
   - Add `orphans` to graph object at all 3 call sites

---

### Phase 3 — UI Changes (Sidebar Tabs)

7. **Rewrite [Sidebar.tsx](packages/vscode-extension/src/webview/app/components/Sidebar.tsx)** (*depends on step 4 — Graph has `orphans`)
   - Tab state: `'analysis' | 'flows' | 'functions'`
   - Tab bar at the top with three styled buttons
   - **Analysis tab**: existing Ignore/Blacklist + Graph Analysis checkboxes (unchanged, just moved into tab)
   - **Flows tab**: search box filtering by entry name; each flow as a list item showing **name** (title), **id** (below in muted text), **connected nodes count**; orphan candidates listed below as non-clickable info items
   - **Functions tab**: search box filtering by name; each function as a list item showing **name**, **id**, **connected nodes count** (edges where node is `from` or `to`)

8. **Add tab CSS** in [index.css](packages/vscode-extension/src/webview/app/index.css) (*parallel with step 7*)

---

### Files that only *read* `isEntryPoint` — no changes needed
- [FunctionNode.tsx](packages/vscode-extension/src/webview/app/components/FunctionNode.tsx#L92) — renders "entry" pill
- [Minimap.tsx](packages/vscode-extension/src/webview/app/components/Minimap.tsx#L14) — green color for entries
- [FlowCanvas.tsx](packages/vscode-extension/src/webview/app/components/FlowCanvas.tsx#L270) — root node dropdown

---

### Verification
1. `pnpm run build` — must compile with zero TS errors
2. A function called by nothing but calling others → `isEntryPoint: true`
3. A recursive function with no external callers → still tagged entry (self-edge excluded)
4. A function with no callers AND no callees → listed in `orphans`, not in any flow
5. Disconnected cluster (A→B→C, unreachable from main entries) → appears as its own mini-flow
6. Pure cycle cluster (A→B→A, unreachable) → mini-flow with synthetic entry
7. Sidebar tabs switch correctly; search boxes filter within their tab
8. Each list item shows name, id, connected node count
9. Existing features (heatmap, git diff, impact radius, focus, go-to-function) still work

---

### Decisions
- `isEntryPoint` stays on `FunctionNode` — read by UI components for rendering. Now set after edge computation instead of at parse time.
- `isDefaultExport` variables fully removed from analyzers (dead code).
- `partitionFlows` return type changes from `Flow[]` to `{ flows: Flow[], orphans: string[] }` — 3 call sites updated.
- Pure cycle clusters treated as mini-flows with arbitrary synthetic entry, not orphans.
- `Graph.orphans` is a `string[]` of node IDs.