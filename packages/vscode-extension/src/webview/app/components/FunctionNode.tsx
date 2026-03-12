import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';

export default function FunctionNode({ data }: { data: any }) {
  const [isHovered, setIsHovered] = useState(false);
  const paramsList = data.params.map((p: any) => p.type ? `${p.name}: ${p.type}` : p.name).join(', ');

  const handleGoto = () => {
    window.vscode.postMessage({
      type: 'GOTO_FUNCTION',
      filePath: data.filePath,
      startLine: data.startLine
    });
  };

  // Get last 2 segments of path
  const pathParts = data.filePath.split(/[/\\]/);
  const shortPath = pathParts.slice(-2).join('/');

  let kindColor = '#2d2d2d'; // default function dark
  let borderColor = '#444'; 
  
  switch (data.kind) {
    case 'component':
      kindColor = '#0f766e'; // teal
      borderColor = '#134e4a';
      break;
    case 'hook':
      kindColor = '#6b21a8'; // purple
      borderColor = '#4c1d95';
      break;
    case 'class':
      kindColor = '#9a3412'; // orange
      borderColor = '#7c2d12';
      break;
    case 'method':
      kindColor = '#1e40af'; // blue
      borderColor = '#1e3a8a';
      break;
  }

  return (
    <div 
      className="function-node" 
      onClick={handleGoto} 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        position: 'relative',
        borderColor, 
        borderTopWidth: 4, 
        borderTopColor: kindColor,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#555', border: 'none', width: '8px', height: '8px' }} />

      {isHovered && (
        <button 
          onClick={(e) => { e.stopPropagation(); data.onFocus?.(data.id); }}
          style={{
            position: 'absolute',
            top: '-12px',
            right: '-12px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '10px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 10
          }}
        >
          FOCUS
        </button>
      )}
      
      <div className="fn-header" style={{ borderBottom: `1px solid ${borderColor}` }}>
        <div>
          <div className="fn-name">{data.name}</div>
          <div className="fn-path">{shortPath}</div>
        </div>
        <div className="pill-container">
          {data.isEntryPoint && <span className="pill entry">entry</span>}
          {data.isAsync && <span className="pill async">async</span>}
        </div>
      </div>

      <div className="fn-params">
        ({paramsList})
      </div>

      {data.returnType && (
        <div className="fn-return">
          <span style={{ opacity: 0.6 }}>→</span> {data.returnType}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: '#38bdf8', border: 'none', width: '8px', height: '8px' }} />
    </div>
  );
}
