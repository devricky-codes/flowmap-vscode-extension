import { FunctionNode, CallEdge, Flow } from '../types';

export function partitionFlows(
  nodes: FunctionNode[],
  edges: CallEdge[]
): { flows: Flow[]; orphans: string[] } {
  const flows: Flow[] = [];
  const visited = new Set<string>();
  const nonSelfEdges = edges.filter(e => e.from !== e.to);

  // 1. BFS from every entry point (in-degree=0, out-degree>0)
  const entryIds = findEntryIds(new Set(nodes.map(n => n.id)), nonSelfEdges);
  for (const eid of entryIds) {
    const reachable = bfs(eid, nonSelfEdges);
    flows.push({ id: eid, entryPoint: eid, nodeIds: [...reachable] });
    reachable.forEach(id => visited.add(id));
  }

  // 2. Iteratively find mini-flows in unvisited subgraph
  let remaining = new Set(nodes.map(n => n.id).filter(id => !visited.has(id)));
  while (remaining.size > 0) {
    const subEdges = nonSelfEdges.filter(e => remaining.has(e.from) && remaining.has(e.to));
    const subEntries = findEntryIds(remaining, subEdges);
    if (subEntries.length === 0) break;

    for (const eid of subEntries) {
      const reachable = bfs(eid, subEdges);
      flows.push({ id: eid, entryPoint: eid, nodeIds: [...reachable] });
      reachable.forEach(id => visited.add(id));
    }
    remaining = new Set([...remaining].filter(id => !visited.has(id)));
  }

  // 3. Remaining nodes with edges (pure cycles) → pick one per component
  remaining = new Set([...remaining]);
  if (remaining.size > 0) {
    const subEdges = nonSelfEdges.filter(e => remaining.has(e.from) && remaining.has(e.to));
    const nodesWithEdges = new Set<string>();
    for (const e of subEdges) { nodesWithEdges.add(e.from); nodesWithEdges.add(e.to); }

    const componentVisited = new Set<string>();
    for (const nid of nodesWithEdges) {
      if (componentVisited.has(nid)) continue;
      // BFS bidirectional to find connected component
      const component = bfsBidirectional(nid, subEdges);
      component.forEach(id => componentVisited.add(id));
      // Pick the first node as synthetic entry
      const syntheticEntry = nid;
      const reachable = bfs(syntheticEntry, subEdges);
      // Include all component members even if not forward-reachable
      component.forEach(id => reachable.add(id));
      flows.push({ id: syntheticEntry, entryPoint: syntheticEntry, nodeIds: [...reachable] });
      reachable.forEach(id => visited.add(id));
    }
    remaining = new Set([...remaining].filter(id => !visited.has(id)));
  }

  // 4. True orphans — zero edges in the full graph
  const orphans = [...remaining];

  return { flows, orphans };
}

function findEntryIds(nodeIds: Set<string>, edges: CallEdge[]): string[] {
  const calledIds = new Set<string>();
  const callerIds = new Set<string>();
  for (const e of edges) {
    if (nodeIds.has(e.from) && nodeIds.has(e.to)) {
      calledIds.add(e.to);
      callerIds.add(e.from);
    }
  }
  return [...nodeIds].filter(id => !calledIds.has(id) && callerIds.has(id));
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

function bfsBidirectional(startId: string, edges: CallEdge[]): Set<string> {
  const visited = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.from === current && !visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push(edge.to);
      }
      if (edge.to === current && !visited.has(edge.from)) {
        visited.add(edge.from);
        queue.push(edge.from);
      }
    }
  }
  return visited;
}
