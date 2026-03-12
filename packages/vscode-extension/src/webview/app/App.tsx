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
        setGraph(message.graph);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Tell extension we are ready to receive data
    window.vscode.postMessage({ type: 'READY' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
      />
      <div style={{ flex: 1, position: 'relative' }}>
        {graph.nodes.length > 500 && (
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 10, backgroundColor: 'rgba(234, 179, 8, 0.9)', color: '#000', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 500 }}>
            Warning: Over 500 nodes detected. Graph performance may degrade.
          </div>
        )}
        <FlowCanvas 
          graph={graph} 
          searchQuery={searchQuery} 
          analysisState={analysisState}
        />
      </div>
    </div>
  );
}
