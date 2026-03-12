import { FunctionNode, RawCall, CallEdge } from '../types';

export function buildCallGraph(
  nodes: FunctionNode[],
  rawCalls: RawCall[]
): CallEdge[] {
  const byName = new Map<string, FunctionNode>();
  for (const n of nodes) byName.set(n.name, n);

  const edges: CallEdge[] = [];

  for (const call of rawCalls) {
    const callee = byName.get(call.calleeName);
    if (!callee) continue;

    const caller = nodes.find(
      n => n.filePath === call.callerFilePath &&
           call.line >= n.startLine &&
           call.line <= n.endLine
    );
    if (!caller) continue;

    edges.push({ from: caller.id, to: callee.id, line: call.line });
  }

  return edges;
}
