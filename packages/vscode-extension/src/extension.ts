import * as vscode from 'vscode';
import { parseFile, buildCallGraph, detectEntryPoints, partitionFlows, initTreeSitter } from '@flowmap/core';
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
          const uris = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx,go,py}', '**/{node_modules,dist,out,build,.git}/**');
          
          if (uris.length === 0) {
            vscode.window.showInformationMessage('FlowMap: No supported files found in workspace.');
            return;
          }

          const allFunctions: any[] = [];
          const allCalls: any[] = [];

          for (const uri of uris) {
            const filePath = vscode.workspace.asRelativePath(uri);
            const absPath = uri.fsPath;
            
            let languageId = 'typescript' as any;
            if (absPath.endsWith('.js')) languageId = 'javascript';
            else if (absPath.endsWith('.jsx')) languageId = 'jsx';
            else if (absPath.endsWith('.tsx')) languageId = 'tsx';
            else if (absPath.endsWith('.go')) languageId = 'go';
            else if (absPath.endsWith('.py')) languageId = 'python';
            else if (absPath.endsWith('.ts')) languageId = 'typescript';
            
            const { functions, calls } = await parseFile(filePath, absPath, wasmDir, languageId);
            allFunctions.push(...functions);
            allCalls.push(...calls);
          }
          
          detectEntryPoints(allFunctions);
          const edges = buildCallGraph(allFunctions, allCalls);
          const flows = partitionFlows(allFunctions, edges);

          const graph = {
            nodes: allFunctions,
            edges,
            flows,
            scannedFiles: uris.length,
            durationMs: Date.now() - startTime
          };

          openFlowMapPanel(context, graph);
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
        vscode.window.showErrorMessage('FlowMap: No active editor to analyze');
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
          
          detectEntryPoints(functions);
          const edges = buildCallGraph(functions, calls);
          const flows = partitionFlows(functions, edges);

          const graph = {
            nodes: functions,
            edges,
            flows,
            scannedFiles: 1,
            durationMs: Date.now() - startTime
          };

          openFlowMapPanel(context, graph);
        }
      );
    } catch (e: any) {
      vscode.window.showErrorMessage('FlowMap Analysis Failed: ' + e.message);
    }
  }
}

export function deactivate() {}
