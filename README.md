# RunUp — App para corridas de rua (Android e iOS)

App para organizadores de corrida e participantes, feito com **Expo (React Native)** e **Supabase**.

| Participante | Organizador / Admin |
|---|---|
| Login e cadastro, vínculo com a corrida (com código do kit) | Painel com KPIs: inscritos, kits, leads, conversão, posts, cliques em patrocinadores |
| Home com a identidade da corrida (capa, cores, logo) e contagem regressiva | Personalização de cada corrida: nome, capa, logo, cores, local, links, status |
| Plano de treino conforme distância e nível, com datas contadas até a prova | Publicações: notícias, avisos, promoções, programação (fixar e agendar) |
| Dicas dos treinadores e de nutrição, liberadas X dias antes da prova | Patrocinadores (cotas, banners, cupons) e métricas por patrocinador |
| Registro de treinos com foto, distância, tempo e pace | Locais e horários de retirada de kit, distâncias, dicas |
| Gráficos de evolução (pace, km acumulado, km por semana) | Planos de treino e sessões |
| **Arte para Instagram** (formato Stories) com foto, distância, tempo, pace e gráfico do histórico | **CRM de leads**: funil, score, WhatsApp, ligação e e-mail, notas, tags, exportação em CSV |
| Retirada de kits: locais, horários, documentos, "como chegar" | Inscritos: nº de peito e check-in da retirada do kit |
| Área de patrocinadores: carrossel, ofertas e cupons | Importação de compras de kit (CSV da plataforma de vendas) |

## Estrutura

```
supabase/
  migrations/20261125000001_schema.sql   ← tabelas, enums, RLS, funções (RPC) e bucket de storage
  seed.sql                               ← corrida de demonstração completa
mobile/                                  ← app Expo (SDK 58, expo-router)
  src/app/(auth)      login e cadastro
  src/app/(tabs)      Início · Treino · Evolução · Corrida · Parceiros
  src/app/admin       painel do organizador
  src/features/admin  formulários genéricos e recursos de CRUD
.github/workflows/build-apps.yml         ← gera os instaladores (EAS Build)
```

## 1. Banco de dados (Supabase)

1. No painel do projeto, abra **SQL Editor**.
2. Cole e rode `supabase/migrations/20261125000001_schema.sql`.
3. Cole e rode `supabase/seed.sql` (dados de teste: corrida *Night Run Sunset 2027*, planos, dicas, patrocinadores, leads).
4. Para testar a autenticação sem confirmar e-mail: **Authentication → Providers → Email**, desligue *Confirm email*.
5. Crie sua conta pelo app e transforme-a em admin:
   ```sql
   update public.profiles set role = 'admin' where email = 'seu@email.com';
   ```
   Use `role = 'organizer'` para um organizador, que só gerencia as corridas que criou ou em que está na equipe (`event_staff`).

**Tabelas:** `profiles`, `events`, `event_staff`, `event_distances`, `kit_purchases`, `kit_pickups`, `registrations`, `training_plans`, `training_sessions`, `workouts`, `tips`, `sponsors`, `sponsor_interactions`, `posts`, `leads`, `lead_interactions`.

**Regras de acesso (RLS):**
- Conteúdo público da corrida (distâncias, kits, patrocinadores, publicações) é visível a todos.
- Treinos e dicas são visíveis só para inscritos.
- Leads e compras de kit são visíveis só para quem gerencia a corrida.
- O usuário não consegue alterar o próprio papel (`role`).
- A inscrição passa pela RPC `register_for_event`, que valida o código do kit e já converte o participante em lead.

Para testar o vínculo por código, use os pedidos do seed: `NRS-1001` a `NRS-1004`.

## 2. Rodar o app

```bash
cd mobile
cp .env.example .env      # preencha EXPO_PUBLIC_SUPABASE_ANON_KEY (Settings → API)
npm install
npx expo start            # leia o QR code com o app Expo Go
```

## 3. Gerar instaladores pelo GitHub Actions

Abra **Actions → "Gerar instaladores" → Run workflow** e escolha a plataforma e o tipo:

| Tipo | O que é | Precisa de |
|---|---|---|
| `development` (padrão) | *Development build*: o app conecta ao `npx expo start` do seu computador, e cada mudança no código aparece na hora | nada |
| `preview` | App completo, com o JS embutido, que roda sozinho | secret `SUPABASE_ANON_KEY` |

### Android (compilado no próprio GitHub, sem conta Expo)
1. No fim da execução, baixe o APK em **Artifacts**. Ele vem dentro de um .zip.
2. Passe o `.apk` para o celular e abra. O Android vai pedir para permitir *instalar apps desconhecidos*.
3. **No `development`:**
   - No computador, rode `cd mobile && npx expo start`, com o celular na mesma rede Wi-Fi. Se estiver em outra rede, use `--tunnel`.
   - Abra o RunUp no celular e escolha o servidor ou leia o QR code.

Todos os APKs são assinados com a mesma chave, então dá para atualizar sem desinstalar o anterior.

Para o `preview`, crie em **Settings → Secrets and variables → Actions**:
- o secret `SUPABASE_ANON_KEY`;
- a variável `SUPABASE_URL`, se usar outro projeto.

### iPhone
A Apple não permite instalar um app fora da App Store num iPhone sem a conta paga **Apple Developer (US$ 99/ano)**. Nenhum workflow contorna isso. Sem a conta, o job de iOS é pulado e não falha.

- **Para testar no iPhone sem pagar:** use o **Expo Go** (seção 2). Rode `npx expo start` e aperte `s` para trocar para o modo Expo Go.
- **Com a conta Apple:**
  - crie o secret `EXPO_TOKEN` (gerado em expo.dev → Access tokens);
  - rode uma vez `npm run setup:ios` em `mobile/`, para registrar o iPhone e criar os certificados;
  - a partir daí, o workflow gera o iOS e mostra o link para instalar.

### Configuração manual do iOS (uma vez, no seu computador)

```bash
cd mobile
cp .env.example .env        # preencha a anon key do Supabase
npm install
npm run setup:ios           # e/ou: npm run setup:android
```

O assistente faz tudo em sequência:
1. Login na Expo. Se você não tiver conta, crie uma grátis em expo.dev.
2. Cria o projeto EAS e grava o `projectId` no `app.json`.
3. Envia a URL e a chave do Supabase, lidas do `.env`, para as variáveis do EAS.
4. **No iOS:** pede o login do Apple ID (Developer) e mostra um link/QR code. Abra-o **no Safari do iPhone** para registrar o aparelho.
5. Gera o primeiro instalador. No iOS, o EAS cria o certificado e o perfil de distribuição automaticamente.

No fim, abra o link do build **no celular** e toque em *Instalar*.

**No iPhone (iOS 16 ou mais novo):**
- Ative **Ajustes → Privacidade e Segurança → Modo de Desenvolvedor** e reinicie o aparelho.
- Na primeira vez que abrir o app, confirme o desenvolvedor em **Ajustes → Geral → VPN e Gerenciamento de Dispositivos**, se o iOS pedir.

Depois faça commit e push do `app.json`.

Uma tag (`git tag v1.0.1 && git push --tags`) gera os instaladores `preview` e anexa à GitHub Release.

Outros comandos:
- **Novo iPhone:** rode `npx eas-cli device:create` e gere um novo build iOS. O perfil ad-hoc precisa incluir o aparelho.
- **Build pelo terminal, sem o CI:** `npm run build:ios` / `npm run build:android`.
- **Mudou a chave do Supabase no `.env`:** `npm run setup:env`.

## Sobre a postagem no Instagram

O app gera a arte no formato Stories (1080×1920). Ela traz foto, distância, tempo, pace e o gráfico da evolução, que acumula o histórico de treinos até a data da prova. A legenda com as hashtags da corrida é **copiada automaticamente**. Depois, o compartilhamento nativo abre o Instagram com a imagem pronta, ou a imagem é salva na galeria.

O Instagram não permite que apps publiquem direto no perfil pessoal de um usuário. A publicação 100% automática só existe na Graph API, para contas Business/Creator, e exige app aprovado pela Meta. O fluxo atual deixa tudo pronto, e o usuário só confirma.
