# Street Running — App para corridas de rua (Android e iOS)

App para organizadores de corrida e participantes, feito com **Expo (React Native)** e **Supabase**.

| Corredor | Administrador (organiza as corridas) |
|---|---|
| Cria conta, inscreve-se na corrida (com código do kit, opcional) | **Controle de acesso** (`st_usuarios`): cadastra administradores pelo e-mail, ativa e desativa acessos |
| Home com a identidade da corrida (capa, cores, logo) e contagem regressiva | **Corridas de rua**: adicionar, editar (nome, logo, capa, cores, local, data) e excluir |
| Plano de treino da sua distância e nível, com datas até a prova | **Gerar treinos**: planos por distância × nível até o dia da prova, editáveis |
| Registra treinos diários com foto, km, tempo e pace | **Retirada de kits**: locais, datas e horários |
| Gráficos de evolução (pace, km acumulado, km por semana) | **Patrocinadores**: banners, cotas, cupons, material (link) e métricas |
| **Post para o Instagram** com foto, km, tempo, pace e gráfico da evolução | Publicações (avisos, notícias, promoções), dicas e nutrição |
| **Comunidade**: mural interno da corrida (texto, foto, treino, curtidas) | Inscritos e check-in de kit · CRM de leads · importação de compras |

## Estrutura

```
supabase/
  migrations/20261126000001_st_schema.sql ← TODAS as tabelas (prefixo st_), funções, RLS e storage
  migrations/20261126000002_st_demo.sql   ← botões Preencher/Limpar modelo (aba Admin)
  migrations/20261126000003_st_corredores.sql ← associar corredores à corrida (admin)
  migrations/20261126000004_st_gestores.sql   ← gestores (cada um com as suas corridas), comentários no mural
  migrations/20261126000005_st_atualizacoes.sql ← feed de atualizações das corridas no Início
  migrations/20261126000006_st_senha_inicial.sql ← cadastro de usuário com senha inicial
  migrations/20261126000007_st_sessao_detalhada.sql ← sessões de treino com etapas, aquecimento e esteira
  migrations/20261126000008_st_relogio.sql ← treinos importados do relógio (Apple Saúde / Health Connect)
  migrations/20261126000009_st_anamnese.sql ← anamnese do corredor + plano de treino pessoal gerado automaticamente
  migrations/20261126000010_st_encerramento.sql ← corrida fecha para os corredores 24 h após a largada
  st_reset.sql                             ← apaga todos os dados do app (recomeçar do zero)
mobile/                                    ← app Expo (SDK 58, expo-router)
  src/app/(auth)      login e cadastro
  src/app/(tabs)      Início · Treino · Evolução · Comunidade · Corrida
  src/app/admin       área do administrador
.github/workflows/build-apps.yml           ← gera APK e IPA e publica a Release
```

## 1. Banco de dados (Supabase)

Todas as tabelas, funções e tipos do app começam com **`st_`**. O app usa o mesmo projeto Supabase do assistencia-ml, e nada `assistencia_*` é alterado.

1. No painel do projeto, abra **SQL Editor → New query**.
2. Cole **todo** o conteúdo de `supabase/migrations/20261126000001_st_schema.sql` e clique em **Run**. O script pode ser rodado mais de uma vez e também remove as tabelas antigas sem prefixo do app.
3. Pronto: o banco começa vazio. Entre no app com `mapl11@hotmail.com` e cadastre tudo pela área do administrador (corridas, distâncias, kits, planos, dicas, patrocinadores, publicações).

4. Cole também `supabase/migrations/20261126000002_st_demo.sql` e clique em **Run**. Ele ativa os botões **Preencher** e **Limpar** do *Modelo de demonstração* na aba **Admin**: um cria um fluxo completo de exemplo (2 corridas com tudo, e você inscrito com treinos), o outro apaga só esse exemplo.
5. Cole também `supabase/migrations/20261126000003_st_corredores.sql` e clique em **Run**. Ele permite ao administrador associar pessoas do controle de acesso a uma corrida (inclusive outros administradores, que também podem correr). Quem ainda não fez o 1º acesso é inscrito automaticamente ao entrar. O mural de cada corrida é visto só pelos corredores inscritos nela.
6. Cole também `supabase/migrations/20261126000004_st_gestores.sql` e clique em **Run**. Ele ativa o modelo de venda: o administrador geral cadastra **gestores**; cada gestor cria as próprias corridas, associa os corredores pelo e-mail e não vê as corridas de outros gestores. O corredor vê só as corridas em que foi associado, e o mural (fotos e comentários) é só entre os corredores da mesma corrida.

7. Cole também `supabase/migrations/20261126000005_st_atualizacoes.sql` e clique em **Run**. Tudo o que o gestor adicionar ou alterar numa corrida (publicações, patrocinadores, kits, distâncias, dicas, planos e dados da corrida) aparece no **Início** dos corredores associados, com a marcação **Novo**.
8. Cole também `supabase/migrations/20261126000006_st_senha_inicial.sql` e clique em **Run**. Assim o administrador cadastra gestores e corredores já com uma **senha inicial** (digitada ou gerada), e a pessoa entra direto no app com e-mail + senha.
9. Cole também `supabase/migrations/20261126000007_st_sessao_detalhada.sql` e clique em **Run**. As sessões dos planos de treino ganham faixa de duração, aquecimento, etapas (aquecimento, tiros, recuperação…) e instruções para esteira, que o corredor vê na tela de detalhe do treino.
10. Cole também `supabase/migrations/20261126000008_st_relogio.sql` e clique em **Run**. Cada corredor pode importar as corridas do próprio relógio (Apple Watch pelo app Saúde no iPhone; Galaxy Watch, Pixel Watch, Garmin etc. pelo Health Connect no Android), com distância, tempo, pace, frequência cardíaca e calorias. No iPhone, o acesso ao Saúde exige o app assinado com conta de desenvolvedor Apple (ou instalado pela App Store).
11. Cole também `supabase/migrations/20261126000009_st_anamnese.sql` e clique em **Run**. O corredor responde a anamnese na aba **Treino** (objetivo, triagem de saúde, rotina, experiência e, se quiser, dados do relógio) e o app gera um plano de treino só dele até o dia da prova. Se a triagem apontar risco, o plano fica bloqueado. O gestor vê as respostas em **Corredores da corrida**.
12. Cole também `supabase/migrations/20261126000010_st_encerramento.sql` e clique em **Run**. 24 horas depois da largada (prazo ajustável por corrida em **Personalizar corrida**) a corrida fecha para os corredores: eles deixam de ver o conteúdo e os Stories dela, mas os treinos continuam deles. O gestor segue vendo tudo, e a corrida passa para **Finalizada**.

> Rode os arquivos sempre nesta ordem: 0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008 → 0009 → 0010. Se rodar o 0001 de novo, rode os outros depois dele.

Para apagar todos os dados e recomeçar do zero, rode `supabase/st_reset.sql`. Ele mantém só o administrador geral e não altera nada do assistencia-ml.

> ⚠️ No SQL Editor, cole apenas arquivos **.sql**. Os scripts `.cjs`/`.mjs` são ferramentas do computador e não rodam no Supabase.

### Controle de acesso (`st_usuarios`)
| Coluna | Significado |
|---|---|
| `email` | e-mail de login, único |
| `full_name` | nome |
| `role` | `athlete` = corredor · `admin` = administrador, que organiza as corridas e vê tudo |
| `ativo` | `false` bloqueia o acesso |
| `user_id` | ligado automaticamente no primeiro login |

- **Administrador geral fixo:** `mapl11@hotmail.com`, que é sempre admin e não pode ser desativado.
- O admin cadastra outros acessos em **Controle de acesso**. A pessoa cria a conta com aquele e-mail e já entra com o papel definido.
- Quem cria conta sozinho pelo app entra como **corredor**.
- Só administradores organizam corridas. Corredores veem apenas a área do corredor e o mural da corrida em que estão inscritos.

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
Toda execução publica uma **GitHub Release** com o APK e o IPA para baixar direto, sem .zip. Pelo botão, ela sai como pré-lançamento `build-<número>`. Com uma tag (`git tag v1.0.1 && git push --tags`), sai como a versão oficial `v1.0.1`.

### Alternativa: EAS Build (nuvem da Expo)
O script `npm run setup:ios` / `setup:android`, em `mobile/`, gera os builds pela EAS, com login na Expo e na Apple. Ele é opcional e o workflow não depende dele.

## E-mail de boas-vindas (opcional)

Quando o gestor associa um corredor a uma corrida, o app chama a Edge Function `st-boas-vindas`, que envia um e-mail com o logo, o nome, as cores, a data e o local da corrida. Sem configurar, a associação funciona normalmente e o app só avisa que o e-mail não saiu.

1. Crie uma conta grátis em [resend.com](https://resend.com), adicione e verifique o **seu domínio** (ex.: `streetrunning.com.br`) e crie uma **API key**.
   Sem domínio verificado, o Resend só envia para o e-mail da própria conta (bom para testar).
2. No Supabase, em **Edge Functions → Secrets**, cadastre:
   - `RESEND_API_KEY` = a chave do Resend
   - `EMAIL_FROM` = o remetente no domínio verificado (ex.: `corridas@streetrunning.com.br`)
3. Em **Edge Functions → Deploy a new function → Via editor**, use o nome `st-boas-vindas` e cole os arquivos de `supabase/functions/st-boas-vindas/` (`index.ts` e `template.ts`).
   Ou pelo terminal: `npx supabase login` e depois `npx supabase functions deploy st-boas-vindas --project-ref eoowbybfrbmjxcjfniuu`.
4. Associe um corredor em **Admin → Corredores da corrida**. O alerta confirma se o e-mail foi enviado.

## Sobre a postagem no Instagram

O app gera a arte no formato Stories (1080×1920). Ela traz foto, distância, tempo, pace e o gráfico da evolução, que acumula o histórico de treinos até a data da prova. A legenda com as hashtags da corrida é **copiada automaticamente**. Depois, o compartilhamento nativo abre o Instagram com a imagem pronta, ou a imagem é salva na galeria.

O Instagram não permite que apps publiquem direto no perfil pessoal de um usuário. A publicação 100% automática só existe na Graph API, para contas Business/Creator, e exige app aprovado pela Meta. O fluxo atual deixa tudo pronto, e o usuário só confirma.
