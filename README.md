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

## 3. Gerar os instaladores (workflow)

O workflow `.github/workflows/build-apps.yml` usa o **EAS Build**, que compila na nuvem da Expo. Ele gera o iOS sem precisar de um Mac.

| Perfil | Android | iOS |
|---|---|---|
| `preview` | **APK**, instala direto no celular | IPA *ad-hoc*, só em aparelhos registrados |
| `production` | **AAB** para a Google Play | IPA para a App Store / TestFlight |

### Configuração (uma vez)

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init          # cria o projeto e grava o projectId no app.json (faça commit)

# variáveis do Supabase usadas no build (para cada ambiente: preview e production)
npx eas-cli@latest env:create --environment preview    --name EXPO_PUBLIC_SUPABASE_URL      --value https://eoowbybfrbmjxcjfniuu.supabase.co --visibility plaintext
npx eas-cli@latest env:create --environment preview    --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key> --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL      --value https://eoowbybfrbmjxcjfniuu.supabase.co --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key> --visibility plaintext

# credenciais (rode uma vez de forma interativa, depois o CI reaproveita)
npx eas-cli@latest credentials -p android      # gera a keystore
npx eas-cli@latest credentials -p ios          # exige conta Apple Developer (US$ 99/ano)
npx eas-cli@latest device:create               # registra iPhones para o build preview (ad-hoc)
```

No GitHub, em **Settings → Secrets and variables → Actions**, crie o secret `EXPO_TOKEN`. O token é gerado em expo.dev → Account settings → Access tokens.

### Uso

- **Manual:** aba **Actions → "Gerar instaladores" → Run workflow**. Escolha a plataforma (android / ios / all), o perfil e se envia às lojas.
- **Por tag:** `git tag v1.0.0 && git push --tags` gera o build de produção de Android e iOS e anexa os links à GitHub Release.
- O resumo de cada execução traz o link de download e a página do build, com um QR code para instalar.
- Para enviar às lojas (`submit`), configure a conta de serviço da Google Play e a API key do App Store Connect em `eas credentials`.

Para buildar localmente, sem o CI: `npm run build:android` / `npm run build:ios`.

## Sobre a postagem no Instagram

O app gera a arte no formato Stories (1080×1920). Ela traz foto, distância, tempo, pace e o gráfico da evolução, que acumula o histórico de treinos até a data da prova. A legenda com as hashtags da corrida é **copiada automaticamente**. Depois, o compartilhamento nativo abre o Instagram com a imagem pronta, ou a imagem é salva na galeria.

O Instagram não permite que apps publiquem direto no perfil pessoal de um usuário. A publicação 100% automática só existe na Graph API, para contas Business/Creator, e exige app aprovado pela Meta. O fluxo atual deixa tudo pronto, e o usuário só confirma.
