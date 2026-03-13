// TODO v0.2: cross-file import resolution
import * as fs from 'fs/promises';
import * as path from 'path';
import Parser from 'web-tree-sitter';
import { loadLanguage } from './treeSitter';
import { Graph, FunctionNode, RawCall, FILE_EXTENSION_MAP, SupportedLanguage, LanguageAnalyzer } from '../types';
import { typescriptAnalyzer } from './languages/typescript';
import { javascriptAnalyzer } from './languages/javascript';
import { tsxAnalyzer } from './languages/tsx';
import { jsxAnalyzer } from './languages/jsx';
import { goAnalyzer } from './languages/go';

import { pythonAnalyzer } from './languages/python';

const ANALYZERS: Record<SupportedLanguage, LanguageAnalyzer | null> = {
  typescript: typescriptAnalyzer,
  tsx: tsxAnalyzer,
  javascript: javascriptAnalyzer,
  jsx: jsxAnalyzer,
  python: pythonAnalyzer,
  java: null,
  go: goAnalyzer,
  rust: null
};

export async function parseFile(
  filePath: string,
  absolutePath: string,
  wasmDirectory: string,
  languageId: SupportedLanguage
): Promise<{ functions: FunctionNode[], calls: RawCall[] }> {
  const analyzer = ANALYZERS[languageId];
  if (!analyzer) return { functions: [], calls: [] };

  const content = await fs.readFile(absolutePath, 'utf8');
  const treeSitterLang = await loadLanguage(languageId, wasmDirectory);
  
  const parser = new Parser();
  parser.setLanguage(treeSitterLang);
  const tree = parser.parse(content);

  let functionQuery: Parser.Query | null = null;
  let callQuery: Parser.Query | null = null;

  try {
    functionQuery = treeSitterLang.query(analyzer.functionQuery);
    callQuery = treeSitterLang.query(analyzer.callQuery);

    const functions: FunctionNode[] = [];
    const calls: RawCall[] = [];

    for (const match of functionQuery.matches(tree.rootNode)) {
      const fn = analyzer.extractFunction(match, filePath);
      if (fn) functions.push(fn);
    }

    for (const match of callQuery.matches(tree.rootNode)) {
      const call = analyzer.extractCall(match, filePath);
      if (call) calls.push(call);
    }

    return { functions, calls };
  } finally {
    if (functionQuery) functionQuery.delete();
    if (callQuery) callQuery.delete();
    if (tree) tree.delete();
    if (parser) parser.delete();
  }
}

export async function parseFileContent(
  filePath: string,
  content: string,
  wasmDirectory: string,
  languageId: SupportedLanguage
): Promise<{ functions: FunctionNode[], calls: RawCall[] }> {
  const analyzer = ANALYZERS[languageId];
  if (!analyzer) return { functions: [], calls: [] };

  const treeSitterLang = await loadLanguage(languageId, wasmDirectory);
  
  const parser = new Parser();
  parser.setLanguage(treeSitterLang);
  const tree = parser.parse(content);

  let functionQuery: Parser.Query | null = null;
  let callQuery: Parser.Query | null = null;

  try {
    functionQuery = treeSitterLang.query(analyzer.functionQuery);
    callQuery = treeSitterLang.query(analyzer.callQuery);

    const functions: FunctionNode[] = [];
    const calls: RawCall[] = [];

    for (const match of functionQuery.matches(tree.rootNode)) {
      const fn = analyzer.extractFunction(match, filePath);
      if (fn) functions.push(fn);
    }

    for (const match of callQuery.matches(tree.rootNode)) {
      const call = analyzer.extractCall(match, filePath);
      if (call) calls.push(call);
    }

    return { functions, calls };
  } finally {
    if (functionQuery) functionQuery.delete();
    if (callQuery) callQuery.delete();
    if (tree) tree.delete();
    if (parser) parser.delete();
  }
}
