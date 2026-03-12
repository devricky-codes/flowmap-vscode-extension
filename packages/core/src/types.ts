export interface Parameter {
  name: string;
  type: string | null;
}

export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'tsx'
  | 'jsx'
  | 'python'
  | 'java'
  | 'go'
  | 'rust';

export const FILE_EXTENSION_MAP: Record<string, SupportedLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
};

export type NodeKind = 'function' | 'component' | 'hook' | 'method' | 'class';

export interface FunctionNode {
  id: string; // format: "relative/path.ts::functionName::startLine"
  name: string;
  filePath: string; // relative to workspace root
  startLine: number; // 0-indexed
  endLine: number;
  params: Parameter[];
  returnType: string | null;
  isAsync: boolean;
  isExported: boolean;
  isEntryPoint: boolean;
  language: SupportedLanguage;
  kind?: NodeKind;
}

export interface CallEdge {
  from: string; // FunctionNode.id of caller
  to: string; // FunctionNode.id of callee
  line: number; // line number of the call site
}

export interface Flow {
  id: string;
  entryPoint: string; // FunctionNode.id — empty string for orphan flow
  nodeIds: string[];
}

export interface Graph {
  nodes: FunctionNode[];
  edges: CallEdge[];
  flows: Flow[];
  scannedFiles: number;
  durationMs: number;
}

export interface RawCall {
  callerFilePath: string;
  calleeName: string;
  line: number; // 0-indexed
}

export interface LanguageAnalyzer {
  functionQuery: string;
  callQuery: string;
  extractFunction(match: any, filePath: string): FunctionNode | null;
  extractCall(match: any, filePath: string): RawCall | null;
}
