import { FunctionNode, RawCall, LanguageAnalyzer } from '../../types';

export const pythonAnalyzer: LanguageAnalyzer = {
  functionQuery: `
(function_definition
  name: (identifier) @fn.name
  parameters: (parameters) @fn.params
  return_type: (type)? @fn.return_type) @fn.decl

(class_definition
  name: (identifier) @class.name) @class.decl
  `,
  callQuery: `
(call
  function: [(identifier) (attribute attribute: (identifier))] @call.name) @call.expr

(call
  function: (attribute attribute: (identifier) @call.name)
  (#match? @call.name "^(Thread|run|submit)$")) @call.expr
  `,
  extractFunction(match: any, filePath: string): FunctionNode | null {
    const declCapture = match.captures.find((c: any) => c.name === 'fn.decl') || match.captures.find((c: any) => c.name === 'class.decl');
    if (!declCapture) return null;

    const nameCapture = match.captures.find((c: any) => c.name === 'fn.name') || match.captures.find((c: any) => c.name === 'class.name');
    
    let fnName = "anonymous";
    let kind: any = 'function';

    if (nameCapture) {
      fnName = nameCapture.node.text;
      if (declCapture.node.type === 'class_definition') kind = 'class';
    } else {
      return null; // Python AST requires names for everything except lambdas, which aren't typically top-level fns here
    }

    const paramsCapture = match.captures.find((c: any) => c.name === 'fn.params');
    const returnCapture = match.captures.find((c: any) => c.name === 'fn.return_type');

    // Python doesn't have explicit export keywords, but names not starting with _ are generally public API
    const isExported = !fnName.startsWith('_');

    // Parse parameters properly into name/type objects
    const paramsList: { name: string; type: string | null }[] = [];
    if (paramsCapture && paramsCapture.node) {
      // In python, the children of parameters node are the actual params
      // typically identifier or typed_parameter or default_parameter
      for (const child of paramsCapture.node.children) {
        if (child.type === 'identifier') {
          paramsList.push({ name: child.text, type: null });
        } else if (child.type === 'typed_parameter') {
          const pName = child.childForFieldName('name') || child.children[0];
          const pType = child.childForFieldName('type') || child.children[2];
          paramsList.push({
            name: pName ? pName.text : child.text,
            type: pType ? pType.text : null
          });
        } else if (child.type === 'default_parameter') {
          const pName = child.childForFieldName('name') || child.children[0];
          paramsList.push({
            name: pName ? pName.text : child.text,
            type: null
          });
        } else if (child.type === 'typed_default_parameter') {
          const pName = child.childForFieldName('name') || child.children[0];
          const pType = child.childForFieldName('type') || child.children[2];
          paramsList.push({
            name: pName ? pName.text : child.text,
            type: pType ? pType.text : null
          });
        }
      }
    }

    function getReturnValues(node: any): string[] {
      const returns: string[] = [];
      function walk(n: any) {
        if (!n) return;
        if (n.type === 'return_statement') {
          const returnClause = n.children.find((c: any) => c.type !== 'return');
          if (returnClause) returns.push(returnClause.text);
        } else {
          for (const child of n.children) {
            if (n !== node && (
              child.type === 'function_definition' ||
              child.type === 'class_definition'
            )) continue;
            walk(child);
          }
        }
      }
      walk(node);
      return Array.from(new Set(returns));
    }

    let finalReturnType = returnCapture ? returnCapture.node.text : null;
    if (!finalReturnType) {
      const returnValues = getReturnValues(declCapture.node);
      if (returnValues.length > 0) {
        finalReturnType = returnValues.join(' | ');
      }
    }

    return {
      id: `${filePath}::${fnName}::${declCapture.node.startPosition.row}`,
      name: fnName,
      filePath,
      startLine: declCapture.node.startPosition.row,
      endLine: declCapture.node.endPosition.row,
      params: paramsList,
      returnType: finalReturnType,
      isAsync: declCapture.node.text.startsWith('async'),
      isExported,
      isEntryPoint: false,
      language: 'python',
      kind
    };
  },
  extractCall(match: any, filePath: string): RawCall | null {
    const nameCapture = match.captures.find((c: any) => c.name === 'call.name');
    const exprCapture = match.captures.find((c: any) => c.name === 'call.expr');
    if (!nameCapture || !exprCapture) return null;

    let calleeName = nameCapture.node.text;
    if (nameCapture.node.type === 'attribute') {
      const attr = nameCapture.node.childForFieldName('attribute');
      if (attr) calleeName = attr.text;
    }

    return {
      callerFilePath: filePath,
      calleeName,
      line: exprCapture.node.startPosition.row
    };
  }
};
