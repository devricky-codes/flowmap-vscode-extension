import { FunctionNode, RawCall, LanguageAnalyzer } from '../../types';

export const goAnalyzer: LanguageAnalyzer = {
  functionQuery: `
(function_declaration
  name: (identifier) @fn.name
  parameters: (parameter_list) @fn.params
  result: [(parameter_list) (type_identifier)]? @fn.return_type) @fn.decl

(method_declaration
  name: (field_identifier) @fn.name
  parameters: (parameter_list) @fn.params
  result: [(parameter_list) (type_identifier)]? @fn.return_type) @fn.decl

(type_declaration
  (type_spec
    name: (type_identifier) @class.name
    type: (struct_type))) @class.decl
  `,
  callQuery: `
(call_expression
  function: [(identifier) (selector_expression field: (field_identifier))] @call.name) @call.expr

(go_statement
  (call_expression
    function: [(identifier) (selector_expression field: (field_identifier))] @call.name)) @call.expr
  `,
  extractFunction(match: any, filePath: string): FunctionNode | null {
    const declCapture = match.captures.find((c: any) => c.name === 'fn.decl') || match.captures.find((c: any) => c.name === 'class.decl');
    if (!declCapture) return null;

    const nameCapture = match.captures.find((c: any) => c.name === 'fn.name') || match.captures.find((c: any) => c.name === 'class.name');
    if (!nameCapture) return null;

    let fnName = nameCapture.node.text;
    let kind: any = 'function';
    
    if (declCapture.node.type === 'method_declaration') kind = 'method';
    else if (declCapture.node.type === 'type_declaration') kind = 'class'; // Map struct to class

    const paramsCapture = match.captures.find((c: any) => c.name === 'fn.params');
    const returnCapture = match.captures.find((c: any) => c.name === 'fn.return_type');

    // Go functions are exported if they start with an uppercase letter
    const isExported = fnName.length > 0 && fnName[0] === fnName[0].toUpperCase();

    // Parse parameters properly into name/type objects
    const paramsList: { name: string; type: string | null }[] = [];
    if (paramsCapture && paramsCapture.node) {
      for (const child of paramsCapture.node.namedChildren) {
        if (child.type === 'parameter_declaration') {
          const typeNode = child.childForFieldName('type');
          const typeStr = typeNode ? typeNode.text : null;
          // Go allows "a, b int"
          const nameNodes = child.namedChildren.filter((n: any) => n.type !== 'type_identifier' && n !== typeNode);
          if (nameNodes.length > 0) {
            for (const n of nameNodes) {
              paramsList.push({ name: n.text, type: typeStr });
            }
          } else {
             paramsList.push({ name: child.text, type: null });
          }
        }
      }
    }

    return {
      id: `${filePath}::${fnName}::${declCapture.node.startPosition.row}`,
      name: fnName,
      filePath,
      startLine: declCapture.node.startPosition.row,
      endLine: declCapture.node.endPosition.row,
      params: paramsList,
      returnType: returnCapture ? returnCapture.node.text : null,
      isAsync: false, // Go uses goroutines at call sites usually
      isExported,
      isEntryPoint: false,
      language: 'go',
      kind
    };
  },
  extractCall(match: any, filePath: string): RawCall | null {
    const nameCapture = match.captures.find((c: any) => c.name === 'call.name');
    const exprCapture = match.captures.find((c: any) => c.name === 'call.expr');
    if (!nameCapture || !exprCapture) return null;

    let calleeName = nameCapture.node.text;
    if (nameCapture.node.type === 'selector_expression') {
      const field = nameCapture.node.childForFieldName('field');
      if (field) calleeName = field.text;
    }

    return {
      callerFilePath: filePath,
      calleeName,
      line: exprCapture.node.startPosition.row
    };
  }
};
