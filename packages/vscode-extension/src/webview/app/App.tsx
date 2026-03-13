import React, { useEffect, useState } from 'react';
import FlowCanvas from './components/FlowCanvas';
import Sidebar from './components/Sidebar';
import { Graph } from '@flowmap/core';

export interface GraphAnalysisState {
  heatmap: boolean;
  impactRadius: boolean;
  impactDepth: number;
  circularDependency: boolean;
  complexityGlow: boolean;
  gitDiff: boolean;
  moduleClustering: boolean;
}

// Declare VS Code API interface
declare global {
  interface Window {
    vscode: {
      postMessage: (msg: any) => void;
    };
  }
}

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFlows, setSelectedFlows] = useState<Set<string>>(new Set());
  const [blacklist, setBlacklist] = useState<string[]>([]);

  const [analysisState, setAnalysisState] = useState<GraphAnalysisState>({
    heatmap: false,
    impactRadius: false,
    impactDepth: 2,
    circularDependency: false,
    complexityGlow: false,
    gitDiff: false,
    moduleClustering: false
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'LOAD_GRAPH') {
        const { graph: loadedGraph, flowmapConfig } = message;
        setGraph(loadedGraph);
        if (flowmapConfig?.blacklist) {
          setBlacklist(flowmapConfig.blacklist);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Tell extension we are ready to receive data
    window.vscode.postMessage({ type: 'READY' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const isLargeGraph = graph ? graph.nodes.length > 500 : false;
  
  // Large graphs: if no specific flows are selected, we pass an empty graph 
  // or a filtered graph. Actually we just filter `graph` object.
  const displayGraph = React.useMemo(() => {
    if (!graph) return null;
    if (!isLargeGraph || selectedFlows.size === 0) return graph;
    const filteredNodes = graph.nodes.filter(n => 
      graph.flows.some(f => selectedFlows.has(f.id) && f.nodeIds.includes(n.id))
    );
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = graph.edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));
    const filteredFlows = graph.flows.filter(f => selectedFlows.has(f.id));
    return { ...graph, nodes: filteredNodes, edges: filteredEdges, flows: filteredFlows };
  }, [graph, isLargeGraph, selectedFlows]);

  if (!graph) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-editor-foreground)' }}>
        <p>Loading codebase flow...</p>
      </div>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-editor-foreground)' }}>
        <p>No functions found in this analysis.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--vscode-editor-background)' }}>
      <Sidebar 
        graph={graph} 
        searchQuery={searchQuery} 
        onSearchChange={setSearchQuery}
        analysisState={analysisState}
        setAnalysisState={setAnalysisState}
        selectedFlows={selectedFlows}
        setSelectedFlows={setSelectedFlows}
        blacklist={blacklist}
        setBlacklist={setBlacklist}
        isLargeGraph={isLargeGraph}
      />
      <div style={{ flex: 1, position: 'relative' }}>
        {isLargeGraph && selectedFlows.size === 0 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10, color: 'var(--vscode-editor-foreground)', textAlign: 'center' }}>
            <h2>Large Codebase Detected ({graph.nodes.length} nodes)</h2>
            <p>Please select one or more flows from the sidebar to render the graph.</p>
          </div>
        )}
        {(!isLargeGraph || selectedFlows.size > 0) && displayGraph && (
          <FlowCanvas 
            graph={displayGraph} 
            searchQuery={searchQuery} 
            analysisState={analysisState}
          />
        )}
      </div>
    </div>
  );
}
