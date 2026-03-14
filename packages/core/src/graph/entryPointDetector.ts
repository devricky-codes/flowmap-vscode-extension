import { FunctionNode, CallEdge } from '../types';

export function detectEntryPoints(nodes: FunctionNode[], edges: CallEdge[]): void {
  const nonSelfEdges = edges.filter(e => e.from !== e.to);
  const calledIds = new Set(nonSelfEdges.map(e => e.to));
  const callerIds = new Set(nonSelfEdges.map(e => e.from));

  for (const node of nodes) {
    node.isEntryPoint = !calledIds.has(node.id) && callerIds.has(node.id);
  }
}
