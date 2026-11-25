# Street Running — App para corridas de rua (Android e iOS)

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
3. Cole e rode `supabase/migrations/20261125000002_generate_plans.sql`. Ela cria a função que gera os treinos preparatórios, usada pelo botão **Gerar treinos** do painel do organizador.
4. Cole e rode `supabase/migrations/20261125000003_admins_comunidade.sql`. Ela cria a gestão de administradores, o material dos patrocinadores e o mural dos corredores.
5. Cole e rode `supabase/seed.sql` (dados de teste: corrida *Night Run Sunset 2027*, planos, dicas, patrocinadores, leads).
6. Para testar a autenticação sem confirmar e-mail: **Authentication → Providers → Email**, desligue *Confirm email*.
7. Crie sua conta pelo app. No primeiro acesso, toque em **Tornar-me administrador**. Os próximos admins são promovidos em **Administradores e acessos**. Também dá para fazer por SQL:
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
npm install               # o Supabase de testes já vem configurado em src/lib/supabase.ts
                          # (.env só se quiser apontar para outro projeto — veja .env.example)
npx expo start            # leia o QR code com o app Expo Go
```

## 3. Gerar instaladores pelo GitHub Actions

Abra **Actions → "Gerar instaladores (APK e IPA)" → Run workflow**. Não há nenhuma opção para escolher. Cada execução gera os **dois instaladores completos**, com o app inteiro dentro, que funcionam sozinhos:

- `android-apk`: `street-running-<versão>.apk`
- `ios-ipa`: `street-running-<versão>-unsigned.ipa`, ou `street-running-<versão>.ipa` se houver os secrets IOS_*

O workflow segue o mesmo modelo do `assistencia-ml` e funciona **sem configurar nenhum secret**:

| Plataforma | Sem secrets | Com secrets |
|---|---|---|
| Android | APK assinado com a chave de debug, que instala em qualquer Android | APK assinado com a sua keystore (`ANDROID_*`) |
| iOS | IPA **sem assinatura**, para instalar com Sideloadly ou AltStore | IPA assinado (`IOS_*`) |

O `versionCode` (Android) e o `buildNumber` (iOS) recebem o número da execução, então cada instalador novo instala por cima do anterior.

### Android (compilado no próprio GitHub, sem conta Expo)
1. No fim da execução, baixe o APK em **Artifacts**. Ele vem dentro de um .zip.
2. Passe o `.apk` para o celular e abra. O Android vai pedir para permitir *instalar apps desconhecidos*.

**Keystore própria (opcional).** Use para distribuir ou para a Play Store. Gere a keystore uma vez e guarde o arquivo e as senhas:
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore release.keystore -alias streetrunning -keyalg RSA -keysize 2048 -validity 10000
```
Em PowerShell, converta para base64 com `[Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore"))`. Depois crie estes secrets:

| Secret | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | a keystore em base64 |
| `ANDROID_KEYSTORE_PASSWORD` | senha da keystore |
| `ANDROID_KEY_ALIAS` | alias (ex.: `streetrunning`) |
| `ANDROID_KEY_PASSWORD` | senha da chave |

**O APK fica em "Instalando…" e não instala:**
1. Extraia o `.apk` do `.zip`.
2. Desinstale qualquer versão anterior assinada com outra chave.
3. Se o Play Protect bloquear, toque em *Mais detalhes → Instalar mesmo assim*.
4. Se ainda não instalar, instale pelo PC com `adb install arquivo.apk`.

**Outro projeto Supabase:** altere `DEFAULT_URL` e `DEFAULT_ANON_KEY` em `mobile/src/lib/supabase.ts`.

### iPhone (compilado no macOS do GitHub, sem EAS)
No fim da execução, baixe o IPA em **Artifacts → ios-ipa**.

**Sem certificados (padrão, grátis).** O workflow gera um IPA **sem assinatura**, que você instala com seu Apple ID comum:
1. Instale o [Sideloadly](https://sideloadly.io) no PC (Windows ou Mac) e o iTunes ou os drivers da Apple.
2. Conecte o iPhone por cabo, arraste o `.ipa` para o Sideloadly, entre com seu Apple ID e clique em *Start*.
3. No iPhone:
   - em **Ajustes → Geral → VPN e Gerenciamento de Dispositivos**, confie no seu Apple ID;
   - ative **Ajustes → Privacidade e Segurança → Modo de Desenvolvedor** (iOS 16+).
4. Com Apple ID gratuito, o app **expira em 7 dias** e o limite é de 3 apps por vez. Para continuar usando, reinstale pelo Sideloadly ou use o AltStore, que renova sozinho.

**Com conta Apple Developer (IPA assinado, sem expirar em 7 dias).** Crie estes secrets no GitHub. O workflow passa a gerar o IPA assinado (*ad-hoc*) automaticamente.

| Secret | Conteúdo |
|---|---|
| `IOS_P12_BASE64` | certificado de distribuição/desenvolvimento `.p12` em base64 |
| `IOS_P12_PASSWORD` | senha do `.p12` |
| `IOS_PROVISION_PROFILE_BASE64` | perfil **Ad Hoc** `.mobileprovision` do bundle `com.streetrunning.app` (com os UDIDs dos iPhones), em base64 |
| `IOS_TEAM_ID` | Team ID da conta Apple |

Para gerar o base64 no PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.p12")) | Set-Clipboard`.

**Sem instalar nada:** o **Expo Go** (seção 2) também roda o app no iPhone. Com `npx expo start`, aperte `s` para entrar no modo Expo Go.

### Release
Uma tag (`git tag v1.0.1 && git push --tags`) gera o APK e o IPA e publica os dois numa GitHub Release.

### Alternativa: EAS Build (nuvem da Expo)
O script `npm run setup:ios` / `setup:android`, em `mobile/`, gera os builds pela EAS, com login na Expo e na Apple. Ele é opcional e o workflow não depende dele.

## Sobre a postagem no Instagram

O app gera a arte no formato Stories (1080×1920). Ela traz foto, distância, tempo, pace e o gráfico da evolução, que acumula o histórico de treinos até a data da prova. A legenda com as hashtags da corrida é **copiada automaticamente**. Depois, o compartilhamento nativo abre o Instagram com a imagem pronta, ou a imagem é salva na galeria.

O Instagram não permite que apps publiquem direto no perfil pessoal de um usuário. A publicação 100% automática só existe na Graph API, para contas Business/Creator, e exige app aprovado pela Meta. O fluxo atual deixa tudo pronto, e o usuário só confirma.
