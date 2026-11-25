#!/usr/bin/env node
/**
 * Configuração única do EAS para gerar instaladores.
 *
 *   npm run setup:ios       → login, projeto, variáveis, registro do iPhone e 1º build iOS
 *   npm run setup:android   → login, projeto, variáveis e 1º build Android (APK)
 *   npm run setup:env       → só envia as variáveis do .env para o EAS
 *
 * Depois disso o workflow do GitHub consegue buildar sozinho (não interativo).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? 'ios';
const EAS = ['--yes', 'eas-cli@latest'];

function eas(args, { allowFail = false } = {}) {
  console.log(`\n\x1b[36m› eas ${args.join(' ')}\x1b[0m`);
  const r = spawnSync('npx', [...EAS, ...args], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0 && !allowFail) {
    console.error(`\n\x1b[31m✖ Falhou: eas ${args.join(' ')}\x1b[0m`);
    process.exit(r.status ?? 1);
  }
  return r.status === 0;
}

function step(title) {
  console.log(`\n\x1b[1m\x1b[35m━━ ${title}\x1b[0m`);
}

function readEnv() {
  const file = join(root, '.env');
  if (!existsSync(file)) {
    console.error('✖ Crie mobile/.env a partir de .env.example (URL e anon key do Supabase).');
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  for (const k of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']) {
    if (!env[k] || env[k].startsWith('cole-aqui')) {
      console.error(`✖ Preencha ${k} em mobile/.env`);
      process.exit(1);
    }
  }
  return env;
}

function pushEnv() {
  step('Enviando variáveis do Supabase para o EAS (preview, production e development)');
  const env = readEnv();
  for (const environment of ['preview', 'production', 'development']) {
    for (const name of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']) {
      eas(['env:create', '--environment', environment, '--name', name, '--value', env[name], '--visibility', 'plaintext', '--force', '--non-interactive']);
    }
  }
}

if (mode === 'env') {
  pushEnv();
  process.exit(0);
}

readEnv();

step('1/4 Login na Expo (crie uma conta grátis em expo.dev se não tiver)');
if (!eas(['whoami'], { allowFail: true })) eas(['login']);

step('2/4 Criando/vinculando o projeto EAS (grava o projectId no app.json)');
eas(['init']);

pushEnv();

if (mode === 'ios') {
  step('3/4 Registrando seu iPhone (abra o link/QR code no Safari do iPhone e instale o perfil)');
  console.log('Requer conta Apple Developer paga. Faça login com seu Apple ID quando solicitado.');
  eas(['device:create']);

  step('4/4 Primeiro build iOS (gera certificado e perfil ad-hoc com o seu iPhone)');
  eas(['build', '--platform', 'ios', '--profile', 'preview']);
} else {
  step('3/4 Gerando keystore e primeiro build Android (APK)');
  eas(['build', '--platform', 'android', '--profile', 'preview']);
}

console.log(`
\x1b[32m✔ Pronto!\x1b[0m
  • Abra o link do build no celular para instalar (ou escaneie o QR code na página do build).
  • Faça commit do app.json (agora com o projectId) e push.
  • Os próximos builds podem ser feitos pelo GitHub Actions (aba Actions → "Gerar instaladores").
  • Novo iPhone? Rode "npx eas-cli device:create" e gere um novo build iOS.
`);
