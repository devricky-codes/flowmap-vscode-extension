import { FunctionNode, CallEdge, Flow } from '../types';

export function partitionFlows(nodes: FunctionNode[], edges: CallEdge[]): Flow[] {
  const flows: Flow[] = [];
  const visited = new Set<string>();
  const entryPoints = nodes.filter(n => n.isEntryPoint);

  for (const entry of entryPoints) {
    const reachable = bfs(entry.id, edges);
    flows.push({ id: entry.id, entryPoint: entry.id, nodeIds: [...reachable] });
    reachable.forEach(id => visited.add(id));
  }

  // Functions unreachable from any entry point → orphan flow
  const orphans = nodes.map(n => n.id).filter(id => !visited.has(id));
  if (orphans.length > 0) {
    flows.push({ id: '__orphans__', entryPoint: '', nodeIds: orphans });
  }

  return flows;
}

function bfs(startId: string, edges: CallEdge[]): Set<string> {
  const visited = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.from === current && !visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  return visited;
}
