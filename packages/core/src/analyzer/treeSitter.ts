import Parser from 'web-tree-sitter';
import * as path from 'path';
import { SupportedLanguage } from '../types';

let initialized = false;

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
  const wasmPath = path.join(wasmDirectory, `tree-sitter-${lang}.wasm`);
  return Parser.Language.load(wasmPath);
}
