import React, { useState, useMemo } from 'react';
import { Graph } from '@flowmap/core';
import { GraphAnalysisState } from '../App';

type SidebarTab = 'analysis' | 'flows' | 'functions';

interface SidebarProps {
  graph: Graph;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  analysisState: GraphAnalysisState;
  setAnalysisState: React.Dispatch<React.SetStateAction<GraphAnalysisState>>;
  selectedFlows: Set<string>;
  setSelectedFlows: React.Dispatch<React.SetStateAction<Set<string>>>;
  blacklist: string[];
  setBlacklist: React.Dispatch<React.SetStateAction<string[]>>;
  isLargeGraph: boolean;
  focusedNodeId: string | null;
  setFocusedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
}

export default function Sidebar({ graph, searchQuery, onSearchChange, analysisState, setAnalysisState, selectedFlows, setSelectedFlows, blacklist, setBlacklist, isLargeGraph, focusedNodeId, setFocusedNodeId }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('analysis');
  const [localBlacklist, setLocalBlacklist] = useState(blacklist.join('\n'));
  const [flowSearch, setFlowSearch] = useState('');
  const [functionSearch, setFunctionSearch] = useState('');

  React.useEffect(() => {
    setLocalBlacklist(blacklist.join('\n'));
  }, [blacklist]);

  const uniqueNodes = Array.from(new Map(graph.nodes.map((n: any) => [n.id, n])).values());

  // Edge count per node for "connected nodes" display
  const connectedCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of graph.edges) {
      if (e.from !== e.to) {
        counts[e.from] = (counts[e.from] || 0) + 1;
        counts[e.to] = (counts[e.to] || 0) + 1;
      }
    }
    return counts;
  }, [graph.edges]);

  const toggleFeature = (key: keyof GraphAnalysisState) => {
    setAnalysisState(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFlow = (flowId: string) => {
    setFocusedNodeId(null);
    setSelectedFlows(prev => {
      const next = new Set(prev);
      if (next.has(flowId)) next.delete(flowId);
      else next.add(flowId);
      return next;
    });
  };

  const applyBlacklist = () => {
    const list = localBlacklist.split('\n').map(s => s.trim()).filter(s => s);
    setBlacklist(list);
    window.vscode.postMessage({ type: 'UPDATE_BLACKLIST', blacklist: list });
  };

  const uniqueFlows = Array.from(new Map(graph.flows.map((f: any) => [f.id, f])).values());

  // Filtered flows by search
  const filteredFlows = useMemo(() => {
    if (!flowSearch) return uniqueFlows;
    const q = flowSearch.toLowerCase();
    return uniqueFlows.filter((f: any) => {
      const entryName = f.entryPoint ? graph.nodes.find((n: any) => n.id === f.entryPoint)?.name || '' : '';
      return entryName.toLowerCase().includes(q) || f.id.toLowerCase().includes(q);
    });
  }, [uniqueFlows, flowSearch, graph.nodes]);

  // Filtered functions by search
  const filteredNodes = useMemo(() => {
    const q = functionSearch.toLowerCase();
    if (!q) return uniqueNodes;
    return uniqueNodes.filter((n: any) => n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q));
  }, [uniqueNodes, functionSearch]);

  // Orphan nodes resolved from IDs
  const orphanNodes = useMemo(() => {
    const orphanSet = new Set(graph.orphans || []);
    return uniqueNodes.filter((n: any) => orphanSet.has(n.id));
  }, [graph.orphans, uniqueNodes]);

  // Also propagate the function search to the global search used by FlowCanvas
  const handleFunctionSearch = (val: string) => {
    setFunctionSearch(val);
    onSearchChange(val);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    background: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: '12px'
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
      {/* Header */}
      <div style={{ padding: '12px 16px 0', borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)' }}>
        <h2 style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px 0', color: 'var(--vscode-sideBarTitle-foreground)' }}>FlowMap</h2>
        {/* Tabs */}
        <div className="sidebar-tabs">
          {(['analysis', 'flows', 'functions'] as SidebarTab[]).map(tab => (
            <button
              key={tab}
              className={`sidebar-tab ${activeTab === tab ? 'sidebar-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* ── Analysis Tab ── */}
        {activeTab === 'analysis' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 8px 0', color: 'var(--vscode-sideBarTitle-foreground)' }}>
                Ignore / Blacklist Patterns
              </h3>
              <textarea
                value={localBlacklist}
                onChange={e => setLocalBlacklist(e.target.value)}
                placeholder="Glob patterns (one per line)..."
                style={{
                  width: '100%',
                  minHeight: '60px',
                  padding: '6px 8px',
                  background: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)',
                  borderRadius: '2px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  marginBottom: '4px'
                }}
              />
              <button
                onClick={applyBlacklist}
                style={{ width: '100%', padding: '4px 0', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', borderRadius: '2px', cursor: 'pointer' }}
              >
                Apply &amp; Re-analyze
              </button>
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
          </>
        )}

        {/* ── Flows Tab ── */}
        {activeTab === 'flows' && (
          <>
            <input
              type="text"
              placeholder="Search flows..."
              value={flowSearch}
              onChange={e => setFlowSearch(e.target.value)}
              style={inputStyle}
            />

            <h3 style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 8px 0', color: 'var(--vscode-sideBarTitle-foreground)' }}>
              Detected Flows ({filteredFlows.length}) {isLargeGraph && '(Select to Render)'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '24px' }}>
              {filteredFlows.map((f: any) => {
                const entryNode = f.entryPoint ? graph.nodes.find((n: any) => n.id === f.entryPoint) : null;
                const entryName = entryNode?.name || 'Disconnected Flow';
                const isSelected = selectedFlows.has(f.id);
                return (
                  <div
                    key={f.id}
                    onClick={() => toggleFlow(f.id)}
                    className="sidebar-list-item"
                    style={{
                      padding: '8px 10px',
                      background: isSelected ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-list-inactiveSelectionBackground)',
                      color: isSelected ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit',
                      border: isSelected ? '1px solid var(--vscode-focusBorder)' : '1px solid transparent',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: '13px' }}>{entryName}</div>
                    <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '2px', fontFamily: 'var(--vscode-editor-font-family)', wordBreak: 'break-all' }}>{f.id}</div>
                    <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>{f.nodeIds.length} connected nodes</div>
                  </div>
                );
              })}
            </div>

            {orphanNodes.length > 0 && (
              <>
                <h3 style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 8px 0', color: 'var(--vscode-sideBarTitle-foreground)' }}>
                  Orphan Candidates ({orphanNodes.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {orphanNodes.map((n: any) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        opacity: 0.6,
                        borderRadius: '4px',
                        background: 'var(--vscode-list-inactiveSelectionBackground)',
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{n.name}</div>
                      <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '2px', fontFamily: 'var(--vscode-editor-font-family)', wordBreak: 'break-all' }}>{n.id}</div>
                      <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>0 connections</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Functions Tab ── */}
        {activeTab === 'functions' && (
          <>
            <input
              type="text"
              placeholder="Search functions..."
              value={functionSearch}
              onChange={e => handleFunctionSearch(e.target.value)}
              style={inputStyle}
            />

            <h3 style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 8px 0', color: 'var(--vscode-sideBarTitle-foreground)' }}>
              Functions ({filteredNodes.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {filteredNodes.map((n: any) => (
                <div
                  key={n.id}
                  className="sidebar-list-item"
                  style={{
                    padding: '8px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: focusedNodeId === n.id ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
                    color: focusedNodeId === n.id ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit',
                  }}
                  onClick={() => setFocusedNodeId(prev => prev === n.id ? null : n.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, fontSize: '13px', fontFamily: 'var(--vscode-editor-font-family)' }}>{n.name}</span>
                    {n.isEntryPoint && <span style={{ fontSize: '10px', color: 'var(--vscode-testing-iconPassed)' }}>ENTRY</span>}
                  </div>
                  <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '2px', fontFamily: 'var(--vscode-editor-font-family)', wordBreak: 'break-all' }}>{n.id}</div>
                  <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>{connectedCount[n.id] || 0} connections</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
