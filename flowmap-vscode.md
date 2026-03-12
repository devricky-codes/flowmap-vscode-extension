# FlowMap — VS Code Extension
### AI IDE Guide · Product Requirements Document

> **Purpose of this file:** This document is the single source of truth for building the FlowMap VS Code extension. Read it fully before writing any code. Follow the architecture, naming conventions, and implementation order exactly as specified.

---

## What You Are Building

A free, fully **local** VS Code extension that parses any codebase and renders an interactive, whiteboard-style call-flow diagram inside a VS Code Webview panel.

- No cloud. No LLM. No telemetry. No per-scan cost.
- Deterministic — same code always produces the same diagram.
- Language-agnostic via Tree-sitter WASM grammars.
- Each function is a node. Edges are call relationships. Parameter names are shown on each node.

---

## Build Strategy — Read This First

**This is Product 1 of 2.** There is a companion MCP server (`flowmap-mcp`) that will be built after this extension. Both products share the same analysis engine.

Because of this, **do not write the parsing and graph logic directly inside the VS Code extension**. Instead, extract it into a separate local package called `@flowmap/core` from the very beginning. The VS Code extension depends on it. The MCP server will also depend on it later — without touching any analysis code.

The monorepo layout is:

```
flowmap-workspace/
├── packages/
│   ├── core/                  ← @flowmap/core — shared analysis engine
│   │   ├── package.json
│   │   └── src/
│   │       ├── analyzer/      ← Tree-sitter parsing + language modules
│   │       ├── graph/         ← call graph, entry points, flow partitioner
│   │       └── types.ts       ← ALL shared types live here
│   │
│   ├── vscode-extension/      ← THIS product — VS Code UI layer only
│   │   ├── package.json       ← depends on @flowmap/core
│   │   └── src/
│   │       ├── extension.ts   ← command registration only
│   │       ├── panel.ts       ← webview panel manager
│   │       └── webview/       ← React canvas app
│   │
│   └── mcp-server/            ← Product 2, built separately — do not create yet
│
└── package.json               ← pnpm/npm workspace root
```

**The VS Code extension layer must only contain:**
- Command registration (`extension.ts`)
- Webview panel management (`panel.ts`)
- The React canvas app (`webview/app/`)

**The following must never live inside the VS Code extension — put them in `@flowmap/core`:**
- Tree-sitter parser loading
- Language query definitions
- `FunctionNode`, `CallEdge`, `Graph`, `Flow` types
- Call graph builder
- Entry point detector
- Flow partitioner

When the MCP server is built later, it imports `@flowmap/core` and gets the full analysis engine immediately — zero rewriting, zero duplication.

---

## Non-Goals (Do Not Build These)

- Type inference for dynamically typed languages (Python, plain JS) — show parameter names only, never `any`
- Runtime tracing or profiling
- Cloud sync or team sharing
- Git history or diff visualisation
- Authentication of any kind

---

## Repository Structure

Use the monorepo layout exclusively. The workspace root contains two packages — `core` and `vscode-extension`. Do not create a flat single-package structure.

```
flowmap-workspace/
├── package.json                          # pnpm/npm workspace root
├── pnpm-workspace.yaml                   # declares packages/*
│
└── packages/
    │
    ├── core/                             # @flowmap/core — shared analysis engine
    │   ├── package.json                  # name: "@flowmap/core"
    │   ├── tsconfig.json
    │   └── src/
    │       ├── types.ts                  # ALL shared types — FunctionNode, CallEdge, Graph, Flow
    │       ├── analyzer/
    │       │   ├── index.ts              # orchestrates file scanning
    │       │   ├── treeSitter.ts         # loads WASM grammars, runs queries
    │       │   ├── importResolver.ts     # resolves cross-file imports
    │       │   ├── fileFilter.ts         # blacklist + whitelist logic (v0.2)
    │       │   └── languages/
    │       │       ├── typescript.ts
    │       │       ├── python.ts
    │       │       ├── java.ts
    │       │       ├── go.ts
    │       │       └── rust.ts
    │       └── graph/
    │           ├── callGraphBuilder.ts
    │           ├── entryPointDetector.ts
    │           └── flowPartitioner.ts
    │
    └── vscode-extension/                 # VS Code extension — UI layer only
        ├── package.json                  # depends on @flowmap/core
        ├── tsconfig.json
        ├── tsconfig.webview.json
        ├── vite.config.ts                # builds the React webview app
        ├── src/
        │   ├── extension.ts              # command registration only
        │   └── webview/
        │       ├── panel.ts              # creates and manages the WebviewPanel
        │       └── app/                  # React app — built by Vite into /media
        │           ├── index.tsx
        │           ├── App.tsx
        │           └── components/
        │               ├── FlowCanvas.tsx
        │               ├── FunctionNode.tsx
        │               ├── Sidebar.tsx
        │               └── Minimap.tsx
        ├── media/                        # Vite build output — committed to repo
        │   ├── webview.js
        │   └── webview.css
        └── grammars/                     # Tree-sitter WASM files — committed to repo
            ├── tree-sitter.wasm
            ├── tree-sitter-typescript.wasm
            ├── tree-sitter-python.wasm
            ├── tree-sitter-java.wasm
            ├── tree-sitter-go.wasm
            └── tree-sitter-rust.wasm
```

**Rule:** If you find yourself creating an `analyzer/` or `graph/` folder inside `vscode-extension/src/`, stop — that code belongs in `packages/core/` instead.

---

## Core Data Types

Define these in `packages/core/src/types.ts`. Do not scatter types across files. Do not redefine any of these in the VS Code extension package.

```typescript
export interface Parameter {
  name: string
  type: string | null   // null for untyped languages — never use "any"
}

export interface FunctionNode {
  id: string            // format: "relative/path.ts::functionName::startLine"
  name: string
  filePath: string      // relative to workspace root
  startLine: number     // 0-indexed
  endLine: number
  params: Parameter[]
  returnType: string | null
  isAsync: boolean
  isExported: boolean
  isEntryPoint: boolean
  language: SupportedLanguage
}

export interface CallEdge {
  from: string          // FunctionNode.id of caller
  to: string            // FunctionNode.id of callee
  line: number          // line number of the call site
}

export interface Flow {
  id: string
  entryPoint: string    // FunctionNode.id — empty string for orphan flow
  nodeIds: string[]
}

export interface Graph {
  nodes: FunctionNode[]
  edges: CallEdge[]
  flows: Flow[]
  scannedFiles: number
  durationMs: number
}

export type SupportedLanguage =
  | 'typescript' | 'javascript'
  | 'python' | 'java'
  | 'go' | 'rust'

export const FILE_EXTENSION_MAP: Record<string, SupportedLanguage> = {
  '.ts':  'typescript',
  '.tsx': 'typescript',
  '.js':  'javascript',
  '.jsx': 'javascript',
  '.py':  'python',
  '.java':'java',
  '.go':  'go',
  '.rs':  'rust',
}
```

---

## Layer 1 — Tree-sitter Parsing

### Loading the Parser (`src/analyzer/treeSitter.ts`)

```typescript
import Parser from 'web-tree-sitter'
import * as path from 'path'
import * as vscode from 'vscode'

let initialized = false

export async function initTreeSitter(extensionUri: vscode.Uri): Promise<void> {
  if (initialized) return
  await Parser.init({
    locateFile: () =>
      vscode.Uri.joinPath(extensionUri, 'grammars', 'tree-sitter.wasm').fsPath,
  })
  initialized = true
}

export async function loadLanguage(
  lang: SupportedLanguage,
  extensionUri: vscode.Uri
): Promise<Parser.Language> {
  const wasmPath = vscode.Uri.joinPath(
    extensionUri, 'grammars', `tree-sitter-${lang}.wasm`
  ).fsPath
  return Parser.Language.load(wasmPath)
}
```

### Language Modules

Each file in `src/analyzer/languages/` must export:

```typescript
export interface LanguageAnalyzer {
  // Tree-sitter s-expression query to extract function declarations
  functionQuery: string
  // Tree-sitter s-expression query to extract call expressions
  callQuery: string
  // Post-process raw query captures into FunctionNode fields
  extractFunction(captures: QueryCaptures, filePath: string): FunctionNode | null
  // Post-process raw query captures into RawCall records
  extractCall(captures: QueryCaptures, filePath: string): RawCall | null
}
```

#### TypeScript query (`src/analyzer/languages/typescript.ts`)

```scheme
; function declarations
(function_declaration
  name: (identifier) @fn.name
  parameters: (formal_parameters) @fn.params
  return_type: (type_annotation)? @fn.return_type) @fn.decl

; arrow functions assigned to variables
(lexical_declaration
  (variable_declarator
    name: (identifier) @fn.name
    value: [(arrow_function) (function_expression)] @fn.decl))

; class methods
(method_definition
  name: (property_identifier) @fn.name
  parameters: (formal_parameters) @fn.params
  return_type: (type_annotation)? @fn.return_type) @fn.decl

; call expressions
(call_expression
  function: [(identifier)(member_expression)] @call.name) @call.expr
```

#### Python query (`src/analyzer/languages/python.ts`)

```scheme
(function_definition
  name: (identifier) @fn.name
  parameters: (parameters) @fn.params
  return_type: (type)? @fn.return_type) @fn.def

(call
  function: (identifier) @call.name) @call.expr
```

#### Go query (`src/analyzer/languages/go.ts`)

```scheme
(function_declaration
  name: (identifier) @fn.name
  parameters: (parameter_list) @fn.params
  result: (parameter_list)? @fn.return_type) @fn.decl

(call_expression
  function: (identifier) @call.name) @call.expr
```

---

## Layer 2 — Graph Engine

### Call Graph Builder (`src/graph/callGraphBuilder.ts`)

Algorithm:
1. Index all `FunctionNode` objects by name AND by `id`.
2. For each `RawCall { callerFilePath, calleeName, line }`, find the callee by name.
3. Find the caller by checking which `FunctionNode` in `callerFilePath` contains `line` within its `startLine`–`endLine` range.
4. If both resolved → push a `CallEdge`. If either is missing → skip silently (stdlib/external call).

```typescript
export function buildCallGraph(
  nodes: FunctionNode[],
  rawCalls: RawCall[]
): CallEdge[] {
  const byName = new Map<string, FunctionNode>()
  for (const n of nodes) byName.set(n.name, n)

  const edges: CallEdge[] = []

  for (const call of rawCalls) {
    const callee = byName.get(call.calleeName)
    if (!callee) continue

    const caller = nodes.find(
      n => n.filePath === call.callerFilePath &&
           call.line >= n.startLine &&
           call.line <= n.endLine
    )
    if (!caller) continue

    edges.push({ from: caller.id, to: callee.id, line: call.line })
  }

  return edges
}
```

### Entry Point Detector (`src/graph/entryPointDetector.ts`)

Apply these heuristics per language. Return the `id` of each detected entry point.

| Language | Heuristic |
|---|---|
| TypeScript / JS | Function named `main`, or default export of `index.ts/js`, or `app.listen(`, or React `createRoot(` call site |
| Python | `if __name__ == "__main__"` block, or function named `main` |
| Java | Method signature `public static void main` |
| Go | Function named `main` in a file where `package main` is declared |
| Rust | Function named `main` |

### Flow Partitioner (`src/graph/flowPartitioner.ts`)

```typescript
export function partitionFlows(nodes: FunctionNode[], edges: CallEdge[]): Flow[] {
  const flows: Flow[] = []
  const visited = new Set<string>()
  const entryPoints = nodes.filter(n => n.isEntryPoint)

  for (const entry of entryPoints) {
    const reachable = bfs(entry.id, edges)
    flows.push({ id: entry.id, entryPoint: entry.id, nodeIds: [...reachable] })
    reachable.forEach(id => visited.add(id))
  }

  // Functions unreachable from any entry point → orphan flow
  const orphans = nodes.map(n => n.id).filter(id => !visited.has(id))
  if (orphans.length > 0) {
    flows.push({ id: '__orphans__', entryPoint: '', nodeIds: orphans })
  }

  return flows
}

function bfs(startId: string, edges: CallEdge[]): Set<string> {
  const visited = new Set<string>([startId])
  const queue = [startId]
  while (queue.length) {
    const current = queue.shift()!
    for (const edge of edges) {
      if (edge.from === current && !visited.has(edge.to)) {
        visited.add(edge.to)
        queue.push(edge.to)
      }
    }
  }
  return visited
}
```

---

## Layer 3 — VS Code Panel

### panel.ts

```typescript
export function openFlowMapPanel(context: vscode.ExtensionContext, graph: Graph) {
  const panel = vscode.window.createWebviewPanel(
    'flowmap',
    'FlowMap',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'media')
      ],
    }
  )

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri)

  // Send graph data after panel is ready
  panel.webview.onDidReceiveMessage(msg => {
    if (msg.type === 'READY') {
      panel.webview.postMessage({ type: 'LOAD_GRAPH', graph })
    }

    if (msg.type === 'GOTO_FUNCTION') {
      const uri = vscode.Uri.file(
        path.join(vscode.workspace.rootPath!, msg.filePath)
      )
      vscode.window.showTextDocument(uri, {
        selection: new vscode.Range(msg.startLine, 0, msg.startLine, 0),
        preserveFocus: false,
      })
    }
  })
}
```

### Message Protocol (extension ↔ webview)

| Direction | Type | Payload |
|---|---|---|
| Extension → Webview | `LOAD_GRAPH` | `{ graph: Graph }` |
| Webview → Extension | `READY` | none |
| Webview → Extension | `GOTO_FUNCTION` | `{ filePath: string, startLine: number }` |

---

## Layer 4 — React Webview App

### FunctionNode component (`src/webview/app/components/FunctionNode.tsx`)

Each node on the canvas renders:
- Function name (bold)
- File path — show only last 2 path segments
- Parameter list — `name: type` for typed languages, `name` only for untyped
- Return type if available, prefixed with `→`
- `async` pill badge if `isAsync === true`
- `entry` pill badge if `isEntryPoint === true`
- React Flow `Handle` on left (target) and right (source)

Clicking the node fires `GOTO_FUNCTION` via `window.vscode.postMessage`.

### FlowCanvas (`src/webview/app/components/FlowCanvas.tsx`)

- Use `@xyflow/react` (React Flow v12)
- Convert `Graph.nodes` → React Flow nodes, `Graph.edges` → React Flow edges
- Use `dagre` layout algorithm for auto-positioning: left-to-right for LR layout, top-to-bottom for TB
- Each `Flow` in `graph.flows` renders in its own section — use a background group node to visually separate flows
- Show flow label at the top of each group (entry function name, or "Orphaned Functions")
- Include `MiniMap`, `Controls`, and `Background` from React Flow

### App.tsx

- On mount: send `READY` to extension, listen for `LOAD_GRAPH`
- Show loading spinner while waiting for graph data
- Show error state if graph has 0 nodes
- Render `<Sidebar>` with flow list and function search on the left
- Render `<FlowCanvas>` on the right
- If `graph.nodes.length > 500` show a warning banner but still render

---

## package.json — Extension Manifest

```json
{
  "name": "flowmap",
  "displayName": "FlowMap",
  "description": "Interactive call-flow diagrams for any codebase. Local, fast, language-agnostic.",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Visualization", "Other"],
  "activationEvents": ["onCommand:flowmap.analyzeWorkspace"],
  "contributes": {
    "commands": [
      {
        "command": "flowmap.analyzeWorkspace",
        "title": "FlowMap: Visualize Entire Codebase"
      },
      {
        "command": "flowmap.analyzeCurrentFile",
        "title": "FlowMap: Visualize Current File"
      },
      {
        "command": "flowmap.traceFromHere",
        "title": "FlowMap: Trace Flow From This Function"
      }
    ],
    "menus": {
      "editor/context": [
        {
          "command": "flowmap.traceFromHere",
          "when": "editorTextFocus",
          "group": "navigation"
        }
      ]
    },
    "configuration": {
      "title": "FlowMap",
      "properties": {
        "flowmap.exclude": {
          "type": "array",
          "default": ["node_modules", "dist", ".git", "__pycache__", "*.test.*", "*.spec.*"],
          "description": "Glob patterns to exclude from analysis"
        },
        "flowmap.autoRefresh": {
          "type": "boolean",
          "default": false,
          "description": "Re-analyse on file save"
        },
        "flowmap.maxNodes": {
          "type": "number",
          "default": 500,
          "description": "Warn if graph exceeds this many nodes"
        },
        "flowmap.layout": {
          "type": "string",
          "enum": ["LR", "TB"],
          "default": "LR",
          "description": "Diagram layout direction"
        }
      }
    }
  }
}
```

---

## v0.2 — File Filtering

This section is scoped to v0.2. Do not build it in v0.1. The filtering logic lives in `@flowmap/core/src/analyzer/fileFilter.ts` so both the VS Code extension and the MCP server share the same behaviour.

### Why It Matters

Without filtering, scanning a real codebase means walking into `node_modules`, `vendor`, `venv`, `.gradle`, `target`, and other dependency directories — which can contain tens of thousands of files. This produces a graph flooded with library internals that the developer never wrote and does not want to see. Filtering must happen **before** any file is opened or parsed, not after.

### Two Mechanisms

**Blacklist — always skip these paths.** Applied first. If a path matches any blacklist entry it is never opened, never parsed, never appears in the graph.

**Whitelist — only scan these paths.** Applied second, only when the user has explicitly configured it. If a whitelist is set, every file must match at least one whitelist entry to be included. If no whitelist is configured, all non-blacklisted files are included.

### Hardcoded Default Blacklist

These are always excluded regardless of user config. They are baked into `@flowmap/core` and cannot be overridden:

```typescript
export const DEFAULT_BLACKLIST: string[] = [
  // JavaScript / TypeScript
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',

  // Python
  'venv',
  '.venv',
  '__pycache__',
  '.mypy_cache',
  '.pytest_cache',
  '*.egg-info',
  'site-packages',

  // Java / Kotlin
  'target',
  '.gradle',
  '.mvn',
  'build/classes',
  'build/generated',

  // Go
  'vendor',

  // Rust
  'target',

  // General
  '.git',
  '.svn',
  '.hg',
  'coverage',
  '.nyc_output',
  'logs',
  '*.log',
]
```

### User-Configurable Settings (v0.2)

Add these to `package.json` configuration:

```json
"flowmap.blacklist": {
  "type": "array",
  "default": [],
  "description": "Additional glob patterns to exclude on top of the built-in defaults. Example: ['src/generated', 'src/vendor']"
},
"flowmap.whitelist": {
  "type": "array",
  "default": [],
  "description": "If non-empty, only files matching these glob patterns are scanned. Example: ['src/core/**', 'src/api/**']. Leave empty to scan everything not blacklisted."
}
```

### Filter Logic (`@flowmap/core/src/analyzer/fileFilter.ts`)

```typescript
import { minimatch } from 'minimatch'

export interface FilterConfig {
  blacklist: string[]   // merged: DEFAULT_BLACKLIST + user blacklist
  whitelist: string[]   // user whitelist only — empty means "allow all"
}

export function shouldScanFile(filePath: string, config: FilterConfig): boolean {
  // Step 1 — blacklist check (always applied)
  for (const pattern of config.blacklist) {
    if (matchesPattern(filePath, pattern)) return false
  }

  // Step 2 — whitelist check (only applied if whitelist is non-empty)
  if (config.whitelist.length === 0) return true
  return config.whitelist.some(pattern => matchesPattern(filePath, pattern))
}

function matchesPattern(filePath: string, pattern: string): boolean {
  // Match against any path segment, not just the full path
  // e.g. pattern 'node_modules' should match 'a/b/node_modules/c/d.ts'
  const parts = filePath.split('/')
  return parts.some(part => minimatch(part, pattern)) ||
         minimatch(filePath, pattern) ||
         minimatch(filePath, `**/${pattern}/**`)
}
```

### Where Filtering Is Called

Filtering runs in `@flowmap/core/src/analyzer/index.ts` during the file discovery step — before any file is read from disk. It is never applied after parsing.

```typescript
const allFiles = await glob('**/*', { cwd: workspacePath })
const filesToScan = allFiles.filter(f => shouldScanFile(f, filterConfig))
// Only filesToScan are ever opened or parsed
```

### Important Rules

- **Default blacklist is always active** — user config adds to it, never replaces it.
- **Whitelist is opt-in and empty by default** — do not apply whitelist logic unless the user has set at least one entry.
- **Filtering is path-based only** — never open a file to inspect its contents to decide whether to scan it.
- **Pattern matching is segment-aware** — `node_modules` should match anywhere in a path, not just at the root.
- **Test files are not blacklisted by default** — users who want to exclude `*.test.ts` must add it to their blacklist config. FlowMap should be able to show test call flows too.

---

## Implementation Order

Follow this order exactly. Do not skip ahead.

1. `src/analyzer/types.ts` — all types first
2. `src/analyzer/treeSitter.ts` — parser loader
3. `src/analyzer/languages/typescript.ts` — start with one language
4. `src/analyzer/index.ts` — wire parser to file scanner
5. `src/graph/callGraphBuilder.ts`
6. `src/graph/entryPointDetector.ts`
7. `src/graph/flowPartitioner.ts`
8. `src/extension.ts` — register commands, call analyzer
9. `src/webview/panel.ts` — create webview panel
10. `src/webview/app/components/FunctionNode.tsx`
11. `src/webview/app/components/FlowCanvas.tsx`
12. `src/webview/app/App.tsx`
13. Add remaining languages one at a time
14. **(v0.2)** `src/analyzer/fileFilter.ts` — blacklist + whitelist filtering

---

## Key Constraints

- **No network calls** — the extension must work fully offline. No `fetch`, no `axios`, no external URLs.
- **No LLM** — all analysis is pure static parsing. Do not call any AI API.
- **Parameter names only for untyped code** — never render `any` as a type. If type is unknown, omit it entirely.
- **IDs must be stable** — `FunctionNode.id` format is `"relativePath::name::startLine"`. Do not change this format.
- **WASM grammars are parsers** — Tree-sitter WASM files parse the target language. They are not related to what language is being analyzed.
- **Cross-file resolution in v0.2** — the MVP can limit analysis to single-file or loose cross-file matching by name. Strict import resolution comes later.
