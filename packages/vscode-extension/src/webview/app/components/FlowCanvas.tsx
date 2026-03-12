import React, { useMemo } from 'react';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  Node, 
  Edge, 
  BackgroundVariant 
} from '@xyflow/react';
import dagre from 'dagre';
import { Graph } from '@flowmap/core';
import FunctionNode from './FunctionNode';
import Minimap from './Minimap';

const nodeTypes = { functionNode: FunctionNode };

const getLayoutedElements = (graph: Graph, direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Estimate node size
  const nodeWidth = 280;
  const nodeHeight = 120;

  dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 120 });

  const rawNodes: Node[] = graph.nodes.map((n: any) => ({
    id: n.id,
    type: 'functionNode',
    data: n,
    position: { x: 0, y: 0 }
  }));

  const rawEdges: Edge[] = graph.edges.map((e: any, idx: number) => ({
    id: `e${idx}-${e.from}-${e.to}`,
    source: e.from,
    target: e.to,
    animated: true,
    style: { stroke: '#94a3b8', strokeWidth: 2 }
  }));

  rawNodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  rawEdges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = rawNodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges: rawEdges };
};

export default function FlowCanvas({ graph }: { graph: Graph }) {
  const { nodes, edges } = useMemo(() => getLayoutedElements(graph), [graph]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.1}
      maxZoom={2}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={2} color="var(--vscode-editorLineNumber-foreground)" />
      <Controls style={{ backgroundColor: 'var(--vscode-editorWidget-background)' }} />
      <Minimap />
    </ReactFlow>
  );
}
