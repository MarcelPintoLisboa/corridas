// Modelo do e-mail de boas-vindas (HTML em tabelas + estilos inline: compatível com Gmail, Outlook e Apple Mail)

export interface WelcomeData {
  runnerName: string | null;
  runnerEmail: string;
  raceName: string;
  raceDate: string; // ISO
  location: string | null;
  city: string | null;
  distance: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  primary: string;
  secondary: string;
  websiteUrl: string | null;
  hasAccount: boolean;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const hex = (c: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : fallback);

function fmtDate(iso: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d);
  return { date: date.charAt(0).toUpperCase() + date.slice(1), time };
}

export function welcomeSubject(d: WelcomeData) {
  return `Bem-vindo(a) à ${d.raceName}! 🏃`;
}

export function welcomeHtml(d: WelcomeData) {
  const c1 = hex(d.primary, '#FF4D2E');
  const c2 = hex(d.secondary, '#7B2FF7');
  const first = (d.runnerName ?? '').trim().split(/\s+/)[0];
  const { date, time } = fmtDate(d.raceDate);
  const where = [d.location, d.city].filter(Boolean).join(' · ');
  const logo = d.logoUrl
    ? `<img src="${esc(d.logoUrl)}" width="88" height="88" alt="${esc(d.raceName)}" style="display:block;width:88px;height:88px;border-radius:20px;background:#ffffff;object-fit:contain;border:4px solid #ffffff;">`
    : `<div style="width:88px;height:88px;line-height:88px;border-radius:20px;background:#ffffff;color:${c1};font:900 38px Arial,sans-serif;text-align:center;">${esc(d.raceName.charAt(0).toUpperCase())}</div>`;
  const row = (icon: string, label: string, value: string) => `
        <tr>
          <td width="44" valign="top" style="padding:10px 0;font-size:22px;">${icon}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eef0f3;">
            <div style="font:700 11px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;color:#8a8fa3;">${label}</div>
            <div style="font:700 16px Arial,sans-serif;color:#15161d;margin-top:2px;">${value}</div>
          </td>
        </tr>`;
  const feature = (icon: string, title: string, text: string) => `
          <tr>
            <td width="40" valign="top" style="padding:8px 0;font-size:20px;">${icon}</td>
            <td style="padding:8px 0;font:14px/1.45 Arial,sans-serif;color:#3b3f4c;"><strong style="color:#15161d;">${title}</strong><br>${text}</td>
          </tr>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(welcomeSubject(d))}</title></head>
<body style="margin:0;padding:0;background:#f2f3f7;">
  <div style="display:none;max-height:0;overflow:hidden;">Sua inscrição na ${esc(d.raceName)} está confirmada. Seu plano de treino e tudo da prova já estão no app.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f3f7;">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 8px 30px rgba(20,22,40,0.08);">
        <!-- cabeçalho com as cores da corrida -->
        <tr><td style="background:${c1};background-image:linear-gradient(135deg,${c1},${c2});padding:34px 28px 30px;" align="center">
          ${logo}
          <div style="font:900 13px Arial,sans-serif;letter-spacing:3px;color:rgba(255,255,255,0.85);margin-top:18px;">INSCRIÇÃO CONFIRMADA</div>
          <div style="font:900 30px/1.15 Arial,sans-serif;color:#ffffff;margin-top:6px;">${esc(d.raceName)}</div>
        </td></tr>

        <tr><td style="padding:30px 28px 8px;">
          <div style="font:900 24px Arial,sans-serif;color:#15161d;">Bem-vindo(a)${first ? `, ${esc(first)}` : ''}! 👋</div>
          <p style="font:16px/1.55 Arial,sans-serif;color:#3b3f4c;margin:10px 0 0;">
            Você foi inscrito(a) na <strong style="color:${c1};">${esc(d.raceName)}</strong>. A partir de agora, seu plano de treino,
            as novidades da prova e a retirada do kit ficam no app <strong>Corre+</strong>.
          </p>
        </td></tr>

        <tr><td style="padding:12px 28px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${row('📅', 'Data e largada', `${esc(date)} · ${esc(time)}`)}
            ${where ? row('📍', 'Local', esc(where)) : ''}
            ${d.distance ? row('🏁', 'Sua distância', esc(d.distance)) : ''}
          </table>
        </td></tr>

        <tr><td style="padding:18px 28px 4px;">
          <div style="background:#f6f7fb;border-radius:16px;padding:16px 18px;">
            <div style="font:800 13px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;color:${c1};margin-bottom:4px;">No app você encontra</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${feature('🏋️', 'Plano de treino até o dia da prova', 'Responda a anamnese e receba treinos feitos para você.')}
              ${feature('📦', 'Retirada do kit', 'Locais, datas, horários e documentos.')}
              ${feature('📸', 'Post pronto para o Instagram', 'Foto, distância, pace e gráfico da sua evolução.')}
              ${feature('💬', 'Stories da corrida', 'Fotos e comentários com quem vai correr com você.')}
            </table>
          </div>
        </td></tr>

        <tr><td style="padding:20px 28px 6px;">
          <div style="border:2px dashed ${c1};border-radius:16px;padding:16px 18px;">
            <div style="font:800 15px Arial,sans-serif;color:#15161d;">Como acessar</div>
            <p style="font:14px/1.5 Arial,sans-serif;color:#3b3f4c;margin:6px 0 0;">
              ${d.hasAccount
                ? 'Abra o app <strong>Corre+</strong> e entre com o seu e-mail: a corrida já aparece na tela inicial.'
                : 'Baixe o app <strong>Corre+</strong> e entre (ou crie sua conta) com este e-mail:'}
            </p>
            <div style="font:800 16px Arial,sans-serif;color:${c1};margin-top:8px;">${esc(d.runnerEmail)}</div>
          </div>
        </td></tr>

        ${d.websiteUrl ? `
        <tr><td align="center" style="padding:22px 28px 4px;">
          <a href="${esc(d.websiteUrl)}" style="display:inline-block;background:${c1};color:#ffffff;font:800 15px Arial,sans-serif;text-decoration:none;padding:14px 26px;border-radius:999px;">Ver informações da prova</a>
        </td></tr>` : ''}

        <tr><td style="padding:26px 28px 30px;">
          <p style="font:15px/1.5 Arial,sans-serif;color:#3b3f4c;margin:0;">Bons treinos e nos vemos na largada! 🔥</p>
          <p style="font:700 15px Arial,sans-serif;color:#15161d;margin:6px 0 0;">Organização · ${esc(d.raceName)}</p>
        </td></tr>
      </table>
      <div style="font:12px/1.5 Arial,sans-serif;color:#9a9fb0;max-width:560px;margin-top:16px;text-align:center;">
        Você recebeu este e-mail porque a organização da ${esc(d.raceName)} associou o seu e-mail à prova no Corre+.
      </div>
    </td></tr>
  </table>
</body></html>`;
}

export function welcomeText(d: WelcomeData) {
  const { date, time } = fmtDate(d.raceDate);
  return [
    `Bem-vindo(a) à ${d.raceName}!`,
    '',
    `Sua inscrição está confirmada.`,
    `Data e largada: ${date} · ${time}`,
    d.location || d.city ? `Local: ${[d.location, d.city].filter(Boolean).join(' · ')}` : '',
    d.distance ? `Sua distância: ${d.distance}` : '',
    '',
    `Acesse o app Corre+ com o e-mail ${d.runnerEmail} para ver seu plano de treino, a retirada do kit e as novidades da prova.`,
    '',
    `Organização · ${d.raceName}`,
  ].filter((l) => l !== null).join('\n');
}
