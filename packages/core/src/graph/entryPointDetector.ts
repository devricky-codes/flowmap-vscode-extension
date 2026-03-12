import { FunctionNode } from '../types';

export function detectEntryPoints(nodes: FunctionNode[]): void {
  for (const node of nodes) {
    if (node.language === 'typescript' || node.language === 'javascript') {
      if (node.name === 'main' || node.name === 'listen' || node.name === 'createRoot') {
        node.isEntryPoint = true;
      }
      else if (node.filePath.endsWith('index.ts') || node.filePath.endsWith('index.js') || node.filePath.endsWith('index.tsx')) {
        if (node.isExported || node.name === 'App') {
          node.isEntryPoint = true; 
        }
      }
    }
  }
}
