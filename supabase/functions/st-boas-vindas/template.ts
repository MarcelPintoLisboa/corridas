// Modelo do e-mail de boas-vindas no padrão visual Corre+ (verde-noite + limão, igual ao app e ao site).
// HTML em tabelas + estilos inline: compatível com Gmail, Outlook e Apple Mail.

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

// Paleta Corre+
const C = {
  deep: '#0C1511',
  night: '#111B17',
  pine: '#24463A',
  lime: '#C7F753',
  paper: '#F4F5EF',
  ink: '#16231C',
  muted: '#4B5B50',
  line: '#DCE1D6',
};
const FONT = "'Inter','Segoe UI',Helvetica,Arial,sans-serif";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function fmtDate(iso: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d);
  return { date: date.charAt(0).toUpperCase() + date.slice(1), time };
}

function daysUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function welcomeSubject(d: WelcomeData) {
  return `Bem-vindo(a) à ${d.raceName}! Sua jornada começa agora 🏃`;
}

export function welcomeHtml(d: WelcomeData) {
  const first = (d.runnerName ?? '').trim().split(/\s+/)[0];
  const { date, time } = fmtDate(d.raceDate);
  const where = [d.location, d.city].filter(Boolean).join(' · ');
  const days = daysUntil(d.raceDate);
  const countdown = days > 1 ? `Faltam ${days} dias` : days === 1 ? 'Falta 1 dia' : 'É hoje!';

  const logo = d.logoUrl
    ? `<img src="${esc(d.logoUrl)}" width="64" height="64" alt="${esc(d.raceName)}" style="display:block;width:64px;height:64px;border-radius:16px;background:#ffffff;object-fit:contain;border:3px solid #ffffff;">`
    : '';

  const info = (label: string, value: string) => `
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid ${C.line};">
                  <div style="font:800 11px ${FONT};letter-spacing:1.4px;text-transform:uppercase;color:${C.muted};">${label}</div>
                  <div style="font:700 16px/1.4 ${FONT};color:${C.ink};margin-top:3px;">${value}</div>
                </td>
              </tr>`;

  const step = (n: string, title: string, text: string) => `
              <tr>
                <td width="46" valign="top" style="padding:10px 0;">
                  <div style="width:34px;height:34px;line-height:34px;border-radius:10px;background:${C.lime};color:${C.deep};font:900 14px ${FONT};text-align:center;">${n}</div>
                </td>
                <td valign="top" style="padding:10px 0;font:14px/1.5 ${FONT};color:rgba(244,245,239,0.78);">
                  <strong style="display:block;font:800 15px ${FONT};color:${C.paper};margin-bottom:2px;">${title}</strong>${text}
                </td>
              </tr>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(welcomeSubject(d))}</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
  <div style="display:none;max-height:0;overflow:hidden;">${first ? `${esc(first)}, você` : 'Você'} está dentro da ${esc(d.raceName)}! Seu plano de treino e tudo da prova já esperam por você no Corre+.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- topo: marca Corre+ -->
        <tr><td style="padding:0 4px 14px;">
          <span style="font:900 22px ${FONT};letter-spacing:-0.5px;color:${C.ink};">Corre<span style="color:${C.pine};">+</span></span>
        </td></tr>

        <!-- destaque verde-noite -->
        <tr><td style="background:${C.deep};background-image:linear-gradient(135deg,${C.pine} 0%,${C.deep} 70%);border-radius:24px 24px 0 0;padding:34px 30px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td valign="top">
              <div style="font:800 11px ${FONT};letter-spacing:2px;color:${C.lime};">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${C.lime};margin-right:7px;vertical-align:middle;"></span>INSCRIÇÃO CONFIRMADA
              </div>
            </td>
            <td align="right" valign="top">${logo}</td>
          </tr></table>
          <div style="font:900 34px/1.05 ${FONT};letter-spacing:-1.2px;color:${C.paper};margin-top:${logo ? '6px' : '18px'};">
            Bem-vindo(a)${first ? `,<br>${esc(first)}` : ''}! <span style="color:${C.lime};">👋</span>
          </div>
          <p style="font:16px/1.6 ${FONT};color:rgba(244,245,239,0.82);margin:16px 0 0;">
            Que alegria ter você com a gente na <strong style="color:${C.lime};">${esc(d.raceName)}</strong>.
            Cada quilômetro até a largada conta — e você não vai correr sozinho(a). A partir de hoje, a gente caminha
            (e corre!) junto com você.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;"><tr>
            <td style="background:${C.lime};border-radius:999px;padding:9px 16px;font:900 13px ${FONT};color:${C.deep};letter-spacing:0.3px;">⏱ ${countdown}</td>
            ${d.distance ? `<td width="8"></td><td style="border:1px solid rgba(244,245,239,0.35);border-radius:999px;padding:8px 16px;font:800 13px ${FONT};color:${C.paper};">🏁 ${esc(d.distance)}</td>` : ''}
          </tr></table>
        </td></tr>

        <!-- dados da prova -->
        <tr><td style="background:#ffffff;padding:22px 30px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${info('Data e largada', `${esc(date)} · ${esc(time)}`)}
            ${where ? info('Local', esc(where)) : ''}
            ${d.distance ? info('Sua distância', esc(d.distance)) : ''}
          </table>
        </td></tr>

        <!-- mensagem acolhedora -->
        <tr><td style="background:#ffffff;padding:18px 30px 26px;">
          <p style="font:15px/1.65 ${FONT};color:${C.muted};margin:0;">
            Não importa se esta é a sua primeira prova ou a centésima: o que vale é o seu ritmo. Preparamos tudo para
            você treinar com segurança, chegar confiante e curtir cada metro do percurso. Se bater qualquer dúvida,
            é só chamar a organização — estamos aqui para ajudar.
          </p>
        </td></tr>

        <!-- próximos passos (bloco verde) -->
        <tr><td style="background:${C.night};padding:26px 30px 22px;">
          <div style="font:800 11px ${FONT};letter-spacing:2px;color:${C.lime};margin-bottom:6px;">SEUS PRÓXIMOS PASSOS</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${step('1', d.hasAccount ? 'Abra o app Corre+' : 'Baixe o app Corre+', d.hasAccount ? 'Entre com o seu e-mail: a corrida já aparece na tela inicial.' : `Entre ou crie sua conta com este e-mail: <strong style="color:${C.lime};">${esc(d.runnerEmail)}</strong>`)}
            ${step('2', 'Responda a anamnese (5 min)', 'Com ela montamos um plano de treino feito para o seu objetivo e a sua rotina.')}
            ${step('3', 'Treine e registre sua evolução', 'Siga o plano até o dia da prova e gere um post pronto para o Instagram a cada treino.')}
            ${step('4', 'Retire seu kit', 'Locais, datas, horários e documentos ficam no app. Aí é só largar!')}
          </table>
        </td></tr>

        ${d.websiteUrl ? `
        <tr><td align="center" style="background:${C.night};padding:4px 30px 30px;">
          <a href="${esc(d.websiteUrl)}" style="display:inline-block;background:${C.lime};color:${C.deep};font:900 15px ${FONT};text-decoration:none;padding:15px 28px;border-radius:10px;">Ver informações da prova →</a>
        </td></tr>` : ''}

        <!-- assinatura -->
        <tr><td style="background:#ffffff;border-radius:0 0 24px 24px;padding:26px 30px 30px;">
          <p style="font:16px/1.5 ${FONT};color:${C.ink};margin:0;">Bons treinos e nos vemos na largada! 💚</p>
          <p style="font:800 15px ${FONT};color:${C.pine};margin:8px 0 0;">Equipe ${esc(d.raceName)} · Corre+</p>
        </td></tr>
      </table>

      <div style="font:12px/1.6 ${FONT};color:#7D8C80;max-width:580px;margin-top:18px;text-align:center;">
        Você recebeu este e-mail porque a organização da ${esc(d.raceName)} associou o seu e-mail à prova no Corre+.<br>
        Corre+ · treino de corrida personalizado · correplus.com.br
      </div>
    </td></tr>
  </table>
</body></html>`;
}

export function welcomeText(d: WelcomeData) {
  const { date, time } = fmtDate(d.raceDate);
  const first = (d.runnerName ?? '').trim().split(/\s+/)[0];
  return [
    `Bem-vindo(a)${first ? `, ${first}` : ''}!`,
    '',
    `Que alegria ter você na ${d.raceName}. Sua inscrição está confirmada.`,
    `Data e largada: ${date} · ${time}`,
    d.location || d.city ? `Local: ${[d.location, d.city].filter(Boolean).join(' · ')}` : '',
    d.distance ? `Sua distância: ${d.distance}` : '',
    '',
    'Seus próximos passos:',
    `1. ${d.hasAccount ? 'Abra o app Corre+ e entre com o seu e-mail' : `Baixe o app Corre+ e entre (ou crie sua conta) com o e-mail ${d.runnerEmail}`}`,
    '2. Responda a anamnese (5 min) para receber seu plano de treino',
    '3. Treine e registre sua evolução',
    '4. Retire seu kit (locais e horários no app)',
    d.websiteUrl ? `\nInformações da prova: ${d.websiteUrl}` : '',
    '',
    'Bons treinos e nos vemos na largada!',
    `Equipe ${d.raceName} · Corre+`,
  ].join('\n');
}
