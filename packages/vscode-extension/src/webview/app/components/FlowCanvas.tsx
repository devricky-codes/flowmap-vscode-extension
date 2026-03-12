import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  Node, 
  Edge, 
  BackgroundVariant,
  useNodesState,
  useEdgesState
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

interface FlowCanvasProps {
  graph: Graph;
  searchQuery: string;
}

export default function FlowCanvas({ graph, searchQuery }: FlowCanvasProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => getLayoutedElements(graph), [graph]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // Re-layout and reset state on new graph data
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setFocusedNodeId(null);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Analyze connection hierarchy for focused node
  const { connectedNodeIds, connectedEdgeIds } = useMemo(() => {
    if (!focusedNodeId) return { connectedNodeIds: new Set(), connectedEdgeIds: new Set() };

    const nodeIds = new Set<string>([focusedNodeId]);
    const edgeIds = new Set<string>();

    graph.edges.forEach((e: any, idx: number) => {
      if (e.from === focusedNodeId || e.to === focusedNodeId) {
        nodeIds.add(e.from);
        nodeIds.add(e.to);
        edgeIds.add(`e${idx}-${e.from}-${e.to}`);
      }
    });

    return { connectedNodeIds: nodeIds, connectedEdgeIds: edgeIds };
  }, [focusedNodeId, graph.edges]);

  // Compute final styles for nodes based on Drag, Search, and Focus states dynamically
  const displayNodes = useMemo(() => {
    return nodes.map((node: Node<any>) => {
      let opacity = 1;
      
      // Focus Isolation rules supreme
      if (focusedNodeId) {
        opacity = connectedNodeIds.has(node.id) ? 1 : 0.15;
      } 
      // Fallback to Search Highlight
      else if (searchQuery) {
        opacity = typeof node.data?.name === 'string' && node.data.name.toLowerCase().includes(searchQuery.toLowerCase()) ? 1 : 0.15;
      }

      return {
        ...node,
        data: {
          ...node.data,
          onFocus: setFocusedNodeId
        },
        style: { ...node.style, opacity, transition: 'opacity 0.2s ease-in-out' }
      };
    });
  }, [nodes, focusedNodeId, connectedNodeIds, searchQuery]);

  // Compute final styles for edges based on Focus states
  const displayEdges = useMemo(() => {
    return edges.map(edge => {
      let opacity = 1;
      
      if (focusedNodeId) {
        opacity = connectedEdgeIds.has(edge.id) ? 1 : 0.15;
      }

      return {
        ...edge,
        style: { ...edge.style, opacity, transition: 'opacity 0.2s ease-in-out' }
      };
    });
  }, [edges, focusedNodeId, connectedEdgeIds]);

  return (
    <>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={2} color="var(--vscode-editorLineNumber-foreground)" />
        <Controls style={{ backgroundColor: 'var(--vscode-editorWidget-background)' }} />
        <Minimap />
      </ReactFlow>

      {focusedNodeId && (
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
          <button 
            onClick={() => setFocusedNodeId(null)}
            style={{
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          >
            Clear Focus
          </button>
        </div>
      )}
    </>
  );
}
