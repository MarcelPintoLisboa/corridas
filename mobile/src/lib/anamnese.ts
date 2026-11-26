/**
 * Anamnese de corrida (mesmo questionário do protótipo HTML):
 *   0 App Saúde · 1 Objetivo · 2 Saúde e segurança · 3 Rotina · 4 Experiência · 5 Revisão
 * As respostas são guardadas com os rótulos em português (como no protótipo) e
 * traduzidas só na exibição.
 */
import type { HealthSummary } from './health.types';

export type Answers = Record<string, string | string[] | undefined>;
export type Route = '' | 'connected' | 'manual';
export type SafetyState = 'eligible' | 'pending' | 'review' | 'urgency';

export const STEPS = ['App Saúde', 'Objetivo', 'Saúde e segurança', 'Rotina', 'Experiência', 'Revisão'];
export const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
/** dia da semana do JS (0 = domingo) para cada rótulo */
export const DAY_JS: Record<string, number> = { Segunda: 1, Terça: 2, Quarta: 3, Quinta: 4, Sexta: 5, Sábado: 6, Domingo: 0 };
export const YN = ['Sim', 'Não'];
export const YNU = ['Sim', 'Não', 'Não sei'];

export const OPT = {
  goal: ['Começar a correr', 'Completar uma prova', 'Aumentar distância', 'Melhorar meu tempo'],
  distance: ['5 km', '10 km', '15 km', '21 km', '42 km', 'Outra'],
  outcome: ['Completar', 'Correr sem caminhar', 'Atingir um tempo específico'],
  restrictionType: ['Restrição ativa', 'Medicação contínua', 'Ambos', 'Não sei'],
  warningWhen: ['Agora', 'Recentemente', 'No passado', 'Não sei'],
  injuryState: ['Resolvida', 'Limita o treino', 'Em avaliação', 'Não sei'],
  frequency: ['1', '2', '3', '4', '5', '6', '7'],
  surface: ['Rua', 'Esteira', 'Pista', 'Misto'],
  recent: ['Sim', 'Estou retomando', 'Nunca corri', 'Não sei'],
  level: ['Iniciante', 'Intermediário', 'Avançado'],
  continuous: ['Ainda não consigo', 'Até 10 min', 'Mais de 10 até 30 min', 'Mais de 30 até 60 min', 'Mais de 60 min', 'Não sei'],
  unit: ['Tempo', 'Distância', 'Indiferente'],
  progression: ['Conservadora', 'Equilibrada', 'Desafiadora'],
};

/** campos que dependem de outra resposta (apagados quando a resposta-mãe muda) */
export const DEPENDENT: Record<string, string> = {
  distance: 'customDistance',
  race: 'date',
  outcome: 'targetTime',
  restriction: 'restrictionType',
  warning: 'warningWhen',
  injury: 'injuryState',
  pain: 'painLimit',
  cross: 'crossType',
};

const str = (v: Answers[string]) => (typeof v === 'string' ? v : '');
export const list = (v: Answers[string]) => (Array.isArray(v) ? v : []);

export function safetyState(a: Answers): SafetyState {
  if (a.warning === 'Sim' && a.warningWhen === 'Agora') return 'urgency';
  const keys = ['condition', 'restriction', 'warning', 'injury', 'pain'];
  if (keys.some((k) => a[k] === 'Sim' && (k !== 'injury' || a.injuryState !== 'Resolvida'))) return 'review';
  if (keys.some((k) => !a[k] || a[k] === 'Não sei')) return 'pending';
  return 'eligible';
}

/** "AAAA-MM-DD" de hoje (horário local) */
function todayIso() {
  const n = new Date();
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, '0'), String(n.getDate()).padStart(2, '0')].join('-');
}

/** Validação de cada etapa; devolve a mensagem (em português, traduzida na tela) ou '' */
export function validate(stage: number, a: Answers, route: Route): string {
  if (stage === 1) {
    if (!a.goal || !a.distance || !a.race || !a.outcome) return 'Selecione as opções de objetivo, distância, prova e meta.';
    if (a.distance === 'Outra' && !(Number(str(a.customDistance).replace(',', '.')) > 0)) return 'Informe uma distância maior que zero.';
    const date = str(a.date);
    if ((a.race === 'Sim' && !date) || (date && date <= todayIso())) return 'Informe uma data futura para a prova ou para o prazo.';
    if (a.outcome === 'Atingir um tempo específico' && (!/^\d{2,}:[0-5]\d:[0-5]\d$/.test(str(a.targetTime)) || !/[1-9]/.test(str(a.targetTime))))
      return 'Informe um tempo maior que zero no formato hh:mm:ss.';
  }
  if (stage === 2) {
    if (a.warning === 'Sim' && a.warningWhen === 'Agora') return '';
    if (['condition', 'restriction', 'warning', 'injury', 'pain'].some((k) => !a[k])) return 'Responda às cinco perguntas de segurança.';
    const details: [string, string][] = [['restriction', 'restrictionType'], ['warning', 'warningWhen'], ['injury', 'injuryState'], ['pain', 'painLimit']];
    if (details.some(([k, d]) => a[k] === 'Sim' && !a[d])) return 'Responda aos detalhes que apareceram na triagem.';
  }
  if (stage === 3) {
    const chosen = list(a.days);
    if (!a.frequency || chosen.length < Number(a.frequency)) return 'Escolha uma frequência que caiba nos dias disponíveis.';
    if (chosen.some((d) => { const m = Number(str(a['minutes' + d])); return !(m > 0) || !Number.isInteger(m); }))
      return 'Informe os minutos disponíveis em todos os dias selecionados.';
  }
  if (stage === 4) {
    if (route === 'manual' && !a.recent) return 'Informe se você tem corrido recentemente.';
    for (const k of ['sessions', 'weeklyKm', 'longest']) {
      const v = str(a[k]);
      if (v && !(Number(v.replace(',', '.')) >= 0)) return 'Revise os valores do histórico informado.';
    }
  }
  return '';
}

/** distância-alvo em km */
export function targetKm(a: Answers) {
  if (a.distance === 'Outra') return Number(str(a.customDistance).replace(',', '.')) || 5;
  const n = parseFloat(str(a.distance));
  return n === 21 ? 21.1 : n === 42 ? 42.2 : n || 5;
}

/** opção de distância do questionário a partir da distância da inscrição */
export function distanceOption(km?: number | null): { distance?: string; customDistance?: string } {
  if (!km) return {};
  const map: Record<string, number> = { '5 km': 5, '10 km': 10, '15 km': 15, '21 km': 21.1, '42 km': 42.2 };
  const hit = Object.entries(map).find(([, v]) => Math.abs(v - km) < 0.6);
  return hit ? { distance: hit[0] } : { distance: 'Outra', customDistance: String(km).replace('.', ',') };
}

/** Linhas de resumo (rótulo → resposta) para a revisão e para o gestor */
export function summaryRows(a: Answers, route: Route, health?: HealthSummary | null): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, v?: string | string[]) => {
    const value = Array.isArray(v) ? v.join(', ') : v;
    if (value) rows.push({ label, value });
  };
  add('Objetivo', str(a.goal));
  add('Distância', a.distance === 'Outra' ? `${str(a.customDistance)} km` : str(a.distance));
  add('Prova marcada', str(a.race));
  add('Data', str(a.date) ? str(a.date).split('-').reverse().join('/') : '');
  add('Meta', a.outcome === 'Atingir um tempo específico' ? `${str(a.outcome)} (${str(a.targetTime)})` : str(a.outcome));
  add('Condição de saúde diagnosticada', str(a.condition));
  add('Restrição médica / medicamentos', a.restriction === 'Sim' ? `Sim · ${str(a.restrictionType)}` : str(a.restriction));
  add('Dor no peito, desmaio, tontura ou falta de ar', a.warning === 'Sim' ? `Sim · ${str(a.warningWhen)}` : str(a.warning));
  add('Lesão que interfere na corrida', a.injury === 'Sim' ? `Sim · ${str(a.injuryState)}` : str(a.injury));
  add('Dor ou limitação atual', a.pain === 'Sim' ? `Sim · ${a.painLimit === 'Sim' ? 'piora com esforço' : str(a.painLimit)}` : str(a.pain));
  add('Dias por semana', str(a.frequency));
  add('Dias disponíveis', list(a.days).map((d) => `${d} (${str(a['minutes' + d])} min)`));
  add('Dia do treino longo', str(a.longDay));
  add('Onde corre', str(a.surface));
  add('Outra atividade', a.cross === 'Sim' ? `Sim${str(a.crossType) ? ` · ${str(a.crossType)}` : ''}` : str(a.cross));
  add('Histórico', route === 'connected' ? 'App Saúde / relógio' : 'Informado manualmente');
  if (route === 'connected' && health) {
    add('Corridas (30 dias)', `${health.runs} · ${health.totalKm} km · maior ${health.longestKm} km`);
    if (health.restingHr) add('FC de repouso', `${health.restingHr} bpm`);
    if (health.vo2max) add('VO₂ máx.', `${health.vo2max}`);
  }
  add('Corre recentemente', str(a.recent));
  add('Corridas por semana', str(a.sessions));
  add('Km por semana', str(a.weeklyKm));
  add('Maior distância (30 dias)', str(a.longest) ? `${str(a.longest)} km` : '');
  add('Condicionamento', str(a.level));
  add('Corre sem caminhar', str(a.continuous));
  add('Treino por', str(a.unit));
  add('Progressão', str(a.progression));
  return rows;
}
