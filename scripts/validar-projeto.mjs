import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requiredFiles = [
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/auth.js',
  'js/conferencia.js',
  'js/historico.js',
  'js/movimentacoes.js',
  'js/produtos.js',
  'js/supabase-config.js',
  'js/utils.js',
  'sql/2026-08-15-evolucao-estoque.sql',
  'sql/2026-09-30-conferencia-por-categoria.sql',
  'docs/demo.html',
  'docs/demo-fluxo.gif',
  'docs/screenshots/01-dashboard.png',
  'docs/screenshots/02-estoque.png',
  'docs/screenshots/03-cadastro.png',
  'docs/screenshots/04-conferencia.png',
  'docs/screenshots/05-historico.png',
  'docs/screenshots/06-mobile-dashboard.png',
];

const errors = [];
for (const relativePath of requiredFiles) {
  if (!existsSync(resolve(root, relativePath))) {
    errors.push(`Arquivo obrigatório ausente: ${relativePath}`);
  }
}

const htmlFiles = ['index.html', 'docs/demo.html'];
const localReferencePattern = /(?:src|href)=["']([^"'#?]+)(?:\?[^"']*)?["']/g;
const optionalBrandAssets = new Set([
  'assets/logo-rpg.png',
  'assets/favicon.png',
  'assets/app-icon.png',
]);

for (const relativeHtml of htmlFiles) {
  const absoluteHtml = resolve(root, relativeHtml);
  const html = readFileSync(absoluteHtml, 'utf8');
  const baseDirectory = dirname(absoluteHtml);
  for (const match of html.matchAll(localReferencePattern)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|data:)/i.test(reference)) continue;
    const normalizedReference = reference.replace(/^\.\//, '');
    if (relativeHtml === 'index.html' && optionalBrandAssets.has(normalizedReference)) {
      continue;
    }
    if (!existsSync(resolve(baseDirectory, reference))) {
      errors.push(`${relativeHtml}: referência local inexistente: ${reference}`);
    }
  }
}

const indexHtml = readFileSync(resolve(root, 'index.html'), 'utf8');
for (const marker of [
  'name="viewport"',
  'id="login-view"',
  'id="app-view"',
  'id="conferencia-categorias"',
  'id="cancelar-conferencia-btn"',
]) {
  if (!indexHtml.includes(marker)) errors.push(`index.html: marcador ausente: ${marker}`);
}

const javascript = requiredFiles
  .filter((path) => path.startsWith('js/'))
  .map((path) => readFileSync(resolve(root, path), 'utf8'))
  .join('\n');

if (/service[_-]?role\s*[:=]/i.test(javascript)) {
  errors.push('Uma credencial service_role parece estar definida no JavaScript público.');
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Validação concluída: ${requiredFiles.length} arquivos e ${htmlFiles.length} páginas verificados.`);
