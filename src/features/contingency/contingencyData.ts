export type ContingencyStageCode =
  | 'normal'
  | 'moderate'
  | 'high'
  | 'very-high'
  | 'maximum';

export type ContingencyStage = {
  code: ContingencyStageCode;
  label: string;
  thresholdM: number;
  actions: string[];
  alarm: string | null;
  sourcePage: number;
};

export type ContingencyRoute = {
  name: string;
  access: string;
  originDestination: string;
  distanceM: number;
  estimatedMinutes: number;
  unavailableAtM: number;
};

export const contingencyPlan = {
  title: 'Plano de Contingencia do Municipio de Mucum',
  version: '2026',
  sourceFile: 'PLANO DE CONTIGENCIA 3.pdf',
  reviewedAt: '2026-07-17',
  riverReference: 'Estacao SGB/CPRM pos-setembro de 2023',
  physicalGaugeReference: 'Regua fisica municipal pos-maio de 2024',
  sourcePages: {
    stages: '20-23',
    evacuation: '24-25',
    shelters: '43-45',
    meetingPoints: '45-46',
    routes: '47-49',
    historicalEvents: '57-60',
  },
} as const;

export const contingencyStages: ContingencyStage[] = [
  {
    code: 'normal',
    label: 'Normal',
    thresholdM: 5,
    alarm: null,
    actions: ['Monitoramento de rotina', 'Atualizar contatos e recursos'],
    sourcePage: 21,
  },
  {
    code: 'moderate',
    label: 'Alerta Moderado',
    thresholdM: 7,
    alarm: null,
    actions: ['Intensificar monitoramento', 'Informar secretarias e parceiros', 'Divulgar comunicados preventivos'],
    sourcePage: 21,
  },
  {
    code: 'high',
    label: 'Alerta Alto',
    thresholdM: 9,
    alarm: 'Preparacao para evacuacao',
    actions: ['Ativar Comite de Crise', 'Monitoramento horario', 'Preparar logistica para possivel evacuacao'],
    sourcePage: 21,
  },
  {
    code: 'very-high',
    label: 'Alerta Muito Alto',
    thresholdM: 15,
    alarm: 'Evacuacao preventiva',
    actions: ['Ativar SCI e Posto de Comando', 'Preparar alojamentos e transporte', 'Retirar preventivamente pessoas vulneraveis'],
    sourcePage: 21,
  },
  {
    code: 'maximum',
    label: 'Alerta Maximo',
    thresholdM: 18,
    alarm: 'Evacuacao obrigatoria',
    actions: ['Evacuar areas mapeadas', 'Abrir alojamentos e acionar socorro', 'Suspender circulacao em areas inundaveis'],
    sourcePage: 21,
  },
];

export const levelReferences = [
  { name: 'SGB/CPRM pos-set/2023', attentionM: 5, alertM: 9, inundationM: 18, sourcePage: 23 },
  { name: 'Regua fisica municipal pos-mai/2024', attentionM: 3, alertM: 7, inundationM: 16, sourcePage: 23 },
  { name: 'SGB/CPRM antes de set/2023', attentionM: 5, alertM: 10, inundationM: 18, sourcePage: 23 },
] as const;

export const historicalFloods = [
  { date: '1912', label: 'Cheia de 1912', levelM: 20.5 },
  { date: '1941-05-05', label: 'Cheia de 1941', levelM: 19.06 },
  { date: '2023-09-06', label: 'Setembro de 2023', levelM: 26.11 },
  { date: '2023-11-08', label: 'Novembro de 2023', levelM: 23.2 },
  { date: '2024-05-01', label: 'Maio de 2024', levelM: 26.1 },
  { date: '2024-05-12', label: 'Repiquete de maio de 2024', levelM: 20.8 },
] as const;

export const riskTerritories = [
  { name: 'Bairro Sao Jose', people: 552, buildings: 138, risk: 'Rios Taquari e Guapore; efeito de represamento do Guapore' },
  { name: 'Centro - Rua Luis Signori', people: 80, buildings: 20, risk: 'Ocupacao urbana ribeirinha sujeita a inundacao sazonal' },
  { name: 'Bairro Centro', people: 100, buildings: 25, risk: 'Inundacao, erosao e instabilidade das margens' },
  { name: 'Bairro Fatima', people: 100, buildings: 25, risk: 'Arroio da Braba, ponte da Av. Sao Cristovao e influencia do Taquari' },
] as const;

export const contingencyShelters = [
  { name: 'Igreja Matriz de Nossa Senhora da Purificacao', capacity: 30, families: 10, address: 'Rua Barao do Rio Branco, 430 - Centro' },
  { name: 'EMEF Jardim Cidade Alta', capacity: 60, families: 15, address: 'Rua Nulvio Moriggi, 10 - Jardim Cidade Alta' },
  { name: 'CTG Sentinela da Tradicao', capacity: 80, families: 20, address: 'Rua Presidente Costa e Silva, 197 - Centro' },
  { name: 'Centro Pastoral', capacity: 32, families: 8, address: 'Rua Jose Bonifacio, 241 - Centro' },
  { name: 'Salao Comunitario Cidade Alta', capacity: 140, families: 35, address: 'Rua Nulvio Moriggi, 21 - Jardim Cidade Alta' },
  { name: 'EMEI Pingo de Gente', capacity: 40, families: 10, address: 'Rua Presidente Costa e Silva, 400 - Centro' },
  { name: 'Salao Comunitario Jose Marcolin', capacity: 36, families: 9, address: 'Rua Clovis Nelson Predebom, 26 - Bairro Guapore' },
  { name: 'Estacao Ferroviaria de Mucum', capacity: 28, families: 6, address: 'Avenida Santa Lucia - Bairro Guapore' },
] as const;

export const meetingPoints = [
  { name: 'Hospital Beneficente Nossa Senhora Aparecida', capacity: 100 },
  { name: 'Igreja Matriz de Nossa Senhora da Purificacao', capacity: 50 },
  { name: 'Salao Comunitario Jardim Cidade Alta', capacity: 100 },
  { name: 'Salao Comunitario Jose Marcolin', capacity: 30 },
  { name: 'Posto Sander', capacity: 100 },
  { name: 'CTG Sentinela da Tradicao', capacity: 100 },
] as const;

export const contingencyRoutes: ContingencyRoute[] = [
  { name: 'Av. Santa Lucia', access: 'Misto', originDestination: 'Trevo ate a Estacao Ferroviaria', distanceM: 1000, estimatedMinutes: 15, unavailableAtM: 22 },
  { name: 'Fundos do Loteamento Jose Marcolin', access: 'Pedestres', originDestination: 'Decibal Moveis ate Carrocerias Mucum', distanceM: 500, estimatedMinutes: 15, unavailableAtM: 24 },
  { name: 'Rua Fernando de Marchi e Rua Presidente Kennedy', access: 'Misto', originDestination: 'Hospital ate a RS-129', distanceM: 860, estimatedMinutes: 15, unavailableAtM: 25 },
  { name: 'Curtume CBR', access: 'Pedestres', originDestination: 'Rua Julio Zarpelon ate Rua Fernando de Marchi', distanceM: 1000, estimatedMinutes: 20, unavailableAtM: 20 },
  { name: 'Igreja Matriz ate o Hospital', access: 'Misto', originDestination: 'Rua Jose Bonifacio e Rua Pinheiro Machado', distanceM: 400, estimatedMinutes: 5, unavailableAtM: 22 },
  { name: 'Loteamento em Fatima ate General Osorio', access: 'Pedestres', originDestination: 'Fundos do loteamento ate Rua General Osorio', distanceM: 250, estimatedMinutes: 15, unavailableAtM: 28 },
  { name: 'Saida de Fatima', access: 'Pedestres', originDestination: 'Av. Sao Cristovao ate a RS-129', distanceM: 370, estimatedMinutes: 10, unavailableAtM: 18 },
];

export function stageForLevel(levelM: number | null | undefined) {
  if (levelM === null || levelM === undefined || !Number.isFinite(levelM)) return null;

  return [...contingencyStages]
    .reverse()
    .find((stage) => levelM >= stage.thresholdM) ?? contingencyStages[0];
}

export function sumCapacity(items: readonly { capacity: number }[]) {
  return items.reduce((total, item) => total + item.capacity, 0);
}
