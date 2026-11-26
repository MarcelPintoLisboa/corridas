/** Corrida lida do relógio (Apple Saúde / Health Connect), já normalizada */
export interface HealthRun {
  externalId: string;
  source: 'apple_health' | 'health_connect';
  start: Date;
  end: Date;
  distanceKm: number;
  durationSec: number;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  elevationM: number | null;
  treadmill: boolean;
  /** app/aparelho que gravou (ex.: "Apple Watch de Ana") */
  deviceName: string | null;
}

export type HealthStatus =
  | 'available'
  /** Android: Health Connect não instalado/desatualizado */
  | 'needs_install'
  /** aparelho/plataforma sem suporte (ex.: web, iPad) */
  | 'unavailable';

export interface HealthProvider {
  /** nome exibido: "Apple Saúde" / "Health Connect" */
  name: string;
  source: HealthRun['source'];
  status(): Promise<HealthStatus>;
  /** pede permissão de leitura; false se negada */
  requestAccess(): Promise<boolean>;
  /** corridas dos últimos `days` dias, mais recentes primeiro */
  listRuns(days: number): Promise<HealthRun[]>;
  /** abre o app/loja para instalar ou ajustar permissões */
  openSettings(): void;
}
