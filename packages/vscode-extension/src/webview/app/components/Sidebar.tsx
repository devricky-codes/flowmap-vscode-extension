import React, { useState } from 'react';
import { Graph } from '@flowmap/core';
import { GraphAnalysisState } from '../App';

interface SidebarProps {
  graph: Graph;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  analysisState: GraphAnalysisState;
  setAnalysisState: React.Dispatch<React.SetStateAction<GraphAnalysisState>>;
}

export default function Sidebar({ graph, searchQuery, onSearchChange, analysisState, setAnalysisState }: SidebarProps) {
  const filteredNodes = graph.nodes.filter((n: any) => n.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const toggleFeature = (key: keyof GraphAnalysisState) => {
    setAnalysisState(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={{
      width: '280px',
      background: 'var(--vscode-sideBar-background)',
      borderRight: '1px solid var(--vscode-sideBar-border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      color: 'var(--vscode-sideBar-foreground)'
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)' }}>
        <h2 style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px 0', color: 'var(--vscode-sideBarTitle-foreground)' }}>FlowMap</h2>
        
        <input 
          type="text" 
          placeholder="Search functions..." 
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border)',
            borderRadius: '2px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 8px 0', color: 'var(--vscode-sideBarTitle-foreground)' }}>
            Detected Flows ({graph.flows.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {graph.flows.map((f: any) => {
              const entryName = f.entryPoint ? graph.nodes.find((n: any) => n.id === f.entryPoint)?.name : 'Orphan Functions';
              return (
                <div key={f.id} style={{ padding: '6px 8px', background: 'var(--vscode-list-inactiveSelectionBackground)', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                  <div style={{ fontWeight: 500 }}>{entryName}</div>
                  <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>{f.nodeIds.length} nodes</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 8px 0', color: 'var(--vscode-sideBarTitle-foreground)' }}>
            Graph Analysis
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={analysisState.heatmap} onChange={() => toggleFeature('heatmap')} />
              Coupling Heatmap
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={analysisState.impactRadius} onChange={() => toggleFeature('impactRadius')} />
              Impact Radius Focus
            </label>
            {analysisState.impactRadius && (
              <div style={{ marginLeft: '24px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span>Depth:</span>
                <button 
                  onClick={() => setAnalysisState(prev => ({ ...prev, impactDepth: Math.max(1, prev.impactDepth - 1) }))}
                  style={{ width: '22px', height: '22px', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >−</button>
                <span style={{ minWidth: '16px', textAlign: 'center', fontWeight: 600 }}>{analysisState.impactDepth}</span>
                <button 
                  onClick={() => setAnalysisState(prev => ({ ...prev, impactDepth: prev.impactDepth + 1 }))}
                  style={{ width: '22px', height: '22px', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >+</button>
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={analysisState.circularDependency} onChange={() => toggleFeature('circularDependency')} />
              Circular Dependencies
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={analysisState.complexityGlow} onChange={() => toggleFeature('complexityGlow')} />
              Complexity Glow
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={analysisState.gitDiff} onChange={() => toggleFeature('gitDiff')} />
              Git Flow Diff
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={analysisState.moduleClustering} onChange={() => toggleFeature('moduleClustering')} />
              Module Clusters
            </label>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 8px 0', color: 'var(--vscode-sideBarTitle-foreground)' }}>
            Functions ({filteredNodes.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredNodes.slice(0, 100).map((n: any) => (
              <div 
                key={n.id} 
                className="sidebar-node"
                style={{ fontSize: '12px', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                onClick={() => {
                  window.vscode.postMessage({ type: 'GOTO_FUNCTION', filePath: n.filePath, startLine: n.startLine });
                }}
              >
                <span style={{ fontFamily: 'var(--vscode-editor-font-family)' }}>{n.name}</span>
                {n.isEntryPoint && <span style={{ fontSize: '10px', color: 'var(--vscode-testing-iconPassed)' }}>ENTRY</span>}
              </div>
            ))}
            {filteredNodes.length > 100 && (
              <div style={{ fontSize: '11px', opacity: 0.5, fontStyle: 'italic', marginTop: '8px' }}>
                And {filteredNodes.length - 100} more...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
