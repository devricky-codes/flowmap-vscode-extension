import { FunctionNode, RawCall, LanguageAnalyzer } from '../../types';

export const javascriptAnalyzer: LanguageAnalyzer = {
  functionQuery: `
(function_declaration
  name: (identifier) @fn.name
  parameters: (formal_parameters) @fn.params) @fn.decl

(lexical_declaration
  (variable_declarator
    name: (identifier) @fn.name
    value: [(arrow_function) (function_expression)] @fn.decl))

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @fn.name
      value: [(arrow_function) (function_expression)] @fn.decl)))

(method_definition
  name: (property_identifier) @fn.name
  parameters: (formal_parameters) @fn.params) @fn.decl

(class_declaration
  name: (identifier) @class.name) @class.decl

(call_expression
  function: (identifier) @hook.name
  arguments: (arguments
    [(arrow_function) (function_expression)] @fn.decl)
  (#match? @hook.name "^use"))
  `,
  callQuery: `
(call_expression
  function: [(identifier)(member_expression)] @call.name) @call.expr

(new_expression
  constructor: (identifier) @call.name) @call.expr

(call_expression
  function: (member_expression
    property: (property_identifier) @call.name
    (#match? @call.name "^(then|catch|finally)$"))) @call.expr
  `,
  extractFunction(match: any, filePath: string): FunctionNode | null {
    const declCapture = match.captures.find((c: any) => c.name === 'fn.decl') || match.captures.find((c: any) => c.name === 'class.decl');
    if (!declCapture) return null;

    const nameCapture = match.captures.find((c: any) => c.name === 'fn.name') || match.captures.find((c: any) => c.name === 'class.name');
    const hookNameCapture = match.captures.find((c: any) => c.name === 'hook.name');

    let rawName = "anonymous";
    let kind: any = 'function';

    if (nameCapture) {
      rawName = nameCapture.node.text;
      if (declCapture.node.type === 'class_declaration') kind = 'class';
      else if (declCapture.node.type === 'method_definition') kind = 'method';
      else if (rawName.length > 0 && rawName[0] === rawName[0].toUpperCase()) kind = 'component'; // JSX Heuristic
    }
    else if (hookNameCapture) {
      rawName = `${hookNameCapture.node.text}_callback`;
      kind = 'hook';
    }

    if (rawName === "anonymous" && !hookNameCapture) return null;

    const paramsCapture = match.captures.find((c: any) => c.name === 'fn.params');

    let isExported = false;
    let isDefaultExport = false;
    let node = declCapture.node;
    while (node && node.type !== 'program') {
      if (node.type === 'export_statement') {
        isExported = true;
        if (node.text.startsWith('export default')) {
          isDefaultExport = true;
        }
        break;
      }
      node = node.parent;
    }

    const paramsList: { name: string; type: string | null }[] = [];
    if (paramsCapture && paramsCapture.node) {
      for (const child of paramsCapture.node.namedChildren) {
        if (child.type === 'identifier') {
          paramsList.push({ name: child.text, type: null });
        } else {
          const pName = child.childForFieldName('pattern') || child.childForFieldName('name');
          paramsList.push({
            name: pName ? pName.text : child.text,
            type: null
          });
        }
      }
    }

    return {
      id: `${filePath}::${rawName}::${declCapture.node.startPosition.row}`,
      name: rawName,
      filePath,
      startLine: declCapture.node.startPosition.row,
      endLine: declCapture.node.endPosition.row,
      params: paramsList,
      returnType: null,
      isAsync: declCapture.node.text.startsWith('async'),
      isExported,
      isEntryPoint: isDefaultExport,
      language: filePath.endsWith('.tsx') || filePath.endsWith('.ts') ? 'typescript' : 'javascript',
      kind
    };
  },
  extractCall(match: any, filePath: string): RawCall | null {
    const nameCapture = match.captures.find((c: any) => c.name === 'call.name');
    const exprCapture = match.captures.find((c: any) => c.name === 'call.expr');
    if (!nameCapture || !exprCapture) return null;
    
    let calleeName = nameCapture.node.text;
    if (nameCapture.node.type === 'member_expression') {
       const prop = nameCapture.node.childForFieldName('property');
       if (prop) calleeName = prop.text;
    }

    return {
      callerFilePath: filePath,
      calleeName,
      line: exprCapture.node.startPosition.row
    };
  }
};
