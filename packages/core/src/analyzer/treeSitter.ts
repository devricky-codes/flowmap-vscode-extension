import Parser from 'web-tree-sitter';
import * as path from 'path';
import { SupportedLanguage } from '../types';

let initialized = false;
const languageCache = new Map<SupportedLanguage, Parser.Language>();

export async function initTreeSitter(wasmDirectory: string): Promise<void> {
  if (initialized) return;
  await Parser.init({
    locateFile: () => path.join(wasmDirectory, 'tree-sitter.wasm'),
  });
  initialized = true;
}

export async function loadLanguage(
  lang: SupportedLanguage,
  wasmDirectory: string
): Promise<Parser.Language> {
  if (languageCache.has(lang)) {
    return languageCache.get(lang)!;
  }
  const wasmName = lang === 'jsx' ? 'javascript' : lang;
  const wasmPath = path.join(wasmDirectory, `tree-sitter-${wasmName}.wasm`);
  const language = await Parser.Language.load(wasmPath);
  languageCache.set(lang, language);
  return language;
}
