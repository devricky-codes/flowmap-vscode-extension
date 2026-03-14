import * as vscode from 'vscode';
import * as cp from 'child_process';
import { minimatch } from 'minimatch';
import { parseFile, parseFileContent, buildCallGraph, detectEntryPoints, partitionFlows, initTreeSitter } from '@flowmap/core';
import { openFlowMapPanel } from './webview/panel';

let treeSitterInitialized = false;

export async function activate(context: vscode.ExtensionContext) {
  const analyzeWorkspaceCmd = vscode.commands.registerCommand('flowmap.analyzeWorkspace', analyzeWorkspace);
  const analyzeCurrentFileCmd = vscode.commands.registerCommand('flowmap.analyzeCurrentFile', analyzeActiveEditor);
  const traceFromHereCmd = vscode.commands.registerCommand('flowmap.traceFromHere', analyzeActiveEditor);

  context.subscriptions.push(analyzeWorkspaceCmd, analyzeCurrentFileCmd, traceFromHereCmd);

  async function analyzeWorkspace() {
    try {
      const wasmDir = vscode.Uri.joinPath(context.extensionUri, 'grammars').fsPath;
      if (!treeSitterInitialized) {
        await initTreeSitter(wasmDir);
        treeSitterInitialized = true;
      }

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "FlowMap: Scanning Workspace..." },
        async () => {
          const startTime = Date.now();
          const config = vscode.workspace.getConfiguration('flowmap');
          const blacklist = config.get<string[]>('blacklist') || [];
          const whitelist = config.get<string[]>('whitelist') || [];
          const defaultExcludes = config.get<string[]>('exclude') || ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/__pycache__/**", "**/*.test.*", "**/*.spec.*"];
          
          let excludePattern = `{${defaultExcludes.join(',')}}`;
          // We'll still fetch all supported types, then manually filter using user blacklist/whitelist
          const uris = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx,go,py}', excludePattern);
          
          if (uris.length === 0) {
            vscode.window.showInformationMessage('FlowMap: No supported files found in workspace.');
            return;
          }

          function matchesPattern(filePath: string, pattern: string): boolean {
            const parts = filePath.split(/[/\\]/);
            return parts.some(part => minimatch(part, pattern)) ||
                   minimatch(filePath, pattern) ||
                   minimatch(filePath, `**/${pattern}/**`);
          }

          function shouldScanFile(filePath: string): boolean {
            // Check blacklist
            for (const pattern of blacklist) {
              if (matchesPattern(filePath, pattern)) return false;
            }
            // Check whitelist
            if (whitelist.length === 0) return true;
            return whitelist.some(pattern => matchesPattern(filePath, pattern));
          }

          const allFunctions: any[] = [];
          const allCalls: any[] = [];

          for (const uri of uris) {
            const filePath = vscode.workspace.asRelativePath(uri);
            if (!shouldScanFile(filePath)) continue;

            const absPath = uri.fsPath;
            
            let languageId = 'typescript' as any;
            if (absPath.endsWith('.js')) languageId = 'javascript';
            else if (absPath.endsWith('.jsx')) languageId = 'jsx';
            else if (absPath.endsWith('.tsx')) languageId = 'tsx';
            else if (absPath.endsWith('.go')) languageId = 'go';
            else if (absPath.endsWith('.py')) languageId = 'python';
            else if (absPath.endsWith('.java')) languageId = 'java';
            else if (absPath.endsWith('.rs')) languageId = 'rust';
            else if (absPath.endsWith('.ts')) languageId = 'typescript';
            
            const { functions, calls } = await parseFile(filePath, absPath, wasmDir, languageId);
            allFunctions.push(...functions);
            allCalls.push(...calls);
          }
          
          const edges = buildCallGraph(allFunctions, allCalls);
          detectEntryPoints(allFunctions, edges);
          const { flows, orphans } = partitionFlows(allFunctions, edges);

          const graph = {
            nodes: allFunctions,
            edges,
            flows,
            orphans,
            scannedFiles: uris.length,
            durationMs: Date.now() - startTime
          };

          openFlowMapPanel(context, graph, (g) => computeGitDiff(g, wasmDir));
        }
      );
    } catch (e: any) {
      vscode.window.showErrorMessage('FlowMap Workspace Analysis Failed: ' + e.message);
    }
  }

  async function analyzeActiveEditor() {
    try {
      const wasmDir = vscode.Uri.joinPath(context.extensionUri, 'grammars').fsPath;
      if (!treeSitterInitialized) {
        await initTreeSitter(wasmDir);
        treeSitterInitialized = true;
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("FlowMap: No active text editor to analyze. Make sure you're focused on a code file, or use 'Visualize Entire Codebase' instead.");
        return;
      }

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "FlowMap: Analyzing..." },
        async () => {
          const startTime = Date.now();
          const filePath = vscode.workspace.asRelativePath(editor.document.uri);
          const absPath = editor.document.uri.fsPath;
          
          let languageId = 'typescript' as any;
          if (absPath.endsWith('.js')) languageId = 'javascript';
          else if (absPath.endsWith('.jsx')) languageId = 'jsx';
          else if (absPath.endsWith('.tsx')) languageId = 'tsx';
          else if (absPath.endsWith('.go')) languageId = 'go';
          else if (absPath.endsWith('.py')) languageId = 'python';
          else if (absPath.endsWith('.ts')) languageId = 'typescript';
          
          const { functions, calls } = await parseFile(filePath, absPath, wasmDir, languageId);
          
          const edges = buildCallGraph(functions, calls);
          detectEntryPoints(functions, edges);
          const { flows, orphans } = partitionFlows(functions, edges);

          const graph = {
            nodes: functions,
            edges,
            flows,
            orphans,
            scannedFiles: 1,
            durationMs: Date.now() - startTime
          };

          openFlowMapPanel(context, graph, (g) => computeGitDiff(g, wasmDir));
        }
      );
    } catch (e: any) {
      vscode.window.showErrorMessage('FlowMap Analysis Failed: ' + e.message);
    }
  }
}

export function deactivate() {}

// === Git Diff Logic ===

function execGit(cwd: string, args: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.exec(`git ${args}`, { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

async function computeGitDiff(
  graph: { nodes: any[]; edges: any[] },
  wasmDir: string
): Promise<{ newEdgeKeys: string[]; deletedEdgeKeys: string[] }> {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) return { newEdgeKeys: [], deletedEdgeKeys: [] };

    // Check if workspace is a git repository
    try {
      await execGit(workspaceFolder, 'rev-parse --is-inside-work-tree');
    } catch {
      // Not a git repository — silently return empty
      return { newEdgeKeys: [], deletedEdgeKeys: [] };
    }

    // get list of changed files
    const diffOutput = await execGit(workspaceFolder, 'diff --name-only HEAD');
    const changedFiles = diffOutput.trim().split('\n').filter(f => f.length > 0);

    if (changedFiles.length === 0) return { newEdgeKeys: [], deletedEdgeKeys: [] };

    const supportedExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go'];
    const relevantFiles = changedFiles.filter(f => supportedExts.some(ext => f.endsWith(ext)));

    if (relevantFiles.length === 0) return { newEdgeKeys: [], deletedEdgeKeys: [] };

    // build old graph from HEAD versions
    const oldFunctions: any[] = [];
    const oldCalls: any[] = [];

    for (const filePath of relevantFiles) {
      let langId = 'typescript' as any;
      if (filePath.endsWith('.js')) langId = 'javascript';
      else if (filePath.endsWith('.jsx')) langId = 'jsx';
      else if (filePath.endsWith('.tsx')) langId = 'tsx';
      else if (filePath.endsWith('.go')) langId = 'go';
      else if (filePath.endsWith('.py')) langId = 'python';

      try {
        const oldContent = await execGit(workspaceFolder, `show HEAD:${filePath.replace(/\\/g, '/')}`);
        const { functions, calls } = await parseFileContent(filePath, oldContent, wasmDir, langId);
        oldFunctions.push(...functions);
        oldCalls.push(...calls);
      } catch {
        // file is new, no old version
      }
    }

    const oldEdges = buildCallGraph(oldFunctions, oldCalls);
    detectEntryPoints(oldFunctions, oldEdges);

    // compare edges
    const oldEdgeSet = new Set(oldEdges.map(e => `${e.from}>>>${e.to}`));
    const newEdgeSet = new Set(graph.edges.map((e: any) => `${e.from}>>>${e.to}`));

    const newEdgeKeys = graph.edges
      .filter((e: any) => !oldEdgeSet.has(`${e.from}>>>${e.to}`))
      .map((_: any, idx: number) => `e${idx}-${graph.edges[idx].from}-${graph.edges[idx].to}`);

    const deletedEdgeKeys = oldEdges
      .filter(e => !newEdgeSet.has(`${e.from}>>>${e.to}`))
      .map(e => `${e.from}>>>${e.to}`);

    return { newEdgeKeys, deletedEdgeKeys };
  } catch (e) {
    console.error('Git diff failed:', e);
    return { newEdgeKeys: [], deletedEdgeKeys: [] };
  }
}
