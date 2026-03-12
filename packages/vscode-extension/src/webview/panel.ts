import * as vscode from 'vscode';
import * as path from 'path';
import { Graph } from '@flowmap/core';

export function openFlowMapPanel(
  context: vscode.ExtensionContext, 
  graph: Graph,
  computeGitDiff?: (graph: { nodes: any[]; edges: any[] }) => Promise<{ newEdgeKeys: string[]; deletedEdgeKeys: string[] }>
) {
  const panel = vscode.window.createWebviewPanel(
    'flowmap',
    'FlowMap',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'media')
      ],
    }
  );

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

  panel.webview.onDidReceiveMessage(async msg => {
    if (msg.type === 'READY') {
      panel.webview.postMessage({ type: 'LOAD_GRAPH', graph });
    }

    if (msg.type === 'GOTO_FUNCTION') {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const uri = vscode.Uri.file(path.join(workspaceFolder, msg.filePath));
      
      vscode.window.showTextDocument(uri, {
        selection: new vscode.Range(msg.startLine, 0, msg.startLine, 0),
        preserveFocus: false,
      });
    }

    if (msg.type === 'REQUEST_GIT_DIFF' && computeGitDiff) {
      const diff = await computeGitDiff(graph);
      panel.webview.postMessage({ type: 'GIT_DIFF_RESULT', ...diff });
    }
  });
}

function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.css'));

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>FlowMap</title>
</head>
<body style="padding: 0; margin: 0; height: 100vh; overflow: hidden; background-color: var(--vscode-editor-background);">
    <div id="root" style="height: 100vh; width: 100vw;"></div>
    <script>
        window.vscode = acquireVsCodeApi();
    </script>
    <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
}
