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
  unavailableAtM: number | null;
};

export const contingencyPlan = {
  title: 'Plano de Contingencia do Municipio de Mucum',
  version: 'Final 17.07.2026',
  sourceFile: 'PLANO DE CONTINGENCIA DE MUCUM - DEFESA CIVIL 17.07 - FINAL.pdf',
  complementarySourceFile: 'PLANO DE CONTIGENCIA 3.pdf',
  reviewedAt: '2026-07-21',
  riverReference: 'Estacao SGB/CPRM pos-setembro de 2023',
  physicalGaugeReference: 'Regua fisica municipal pos-maio de 2024',
  sourcePages: {
    monitoring: '28-30',
    stages: '31-35',
    evacuation: '44-47',
    shelters: '60-63',
    meetingPoints: '63-64',
    routes: '64-68',
    historicalEvents: '57-60 do plano complementar',
  },
} as const;

export const contingencyStages: ContingencyStage[] = [
  {
    code: 'normal',
    label: 'Normal',
    thresholdM: 5,
    alarm: null,
    actions: ['Monitoramento de rotina', 'Atualizar contatos e recursos'],
    sourcePage: 33,
  },
  {
    code: 'moderate',
    label: 'Alerta Moderado',
    thresholdM: 7,
    alarm: null,
    actions: ['Intensificar monitoramento', 'Informar secretarias e parceiros', 'Divulgar comunicados preventivos'],
    sourcePage: 33,
  },
  {
    code: 'high',
    label: 'Alerta Alto',
    thresholdM: 9,
    alarm: 'Preparacao para evacuacao',
    actions: ['Ativar Comite de Crise', 'Monitoramento horario', 'Preparar logistica para possivel evacuacao'],
    sourcePage: 33,
  },
  {
    code: 'very-high',
    label: 'Alerta Muito Alto',
    thresholdM: 15,
    alarm: 'Evacuacao preventiva',
    actions: ['Ativar SCI e Posto de Comando', 'Preparar alojamentos e transporte', 'Retirar preventivamente pessoas vulneraveis'],
    sourcePage: 33,
  },
  {
    code: 'maximum',
    label: 'Alerta Maximo',
    thresholdM: 18,
    alarm: 'Evacuacao obrigatoria',
    actions: ['Evacuar areas mapeadas', 'Abrir alojamentos e acionar socorro', 'Suspender circulacao em areas inundaveis'],
    sourcePage: 33,
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

export const municipalMonitoringAssets = {
  riverLevelEquipment: 5,
  localRainGauges: [
    { code: '431260901A', name: 'Linha 13 de Maio', latitude: -29.124382, longitude: -51.770333 },
    { code: '431260902A', name: 'Cidade Alta', latitude: -29.154395, longitude: -51.863519 },
    { code: '431260903A', name: 'Centro', latitude: -29.166765, longitude: -51.871557 },
  ],
  riverCamera: 'Ponte Rodoferroviaria Brochado da Rocha',
  sourcePages: '29-30',
} as const;

export const territorialEvacuation = [
  { levelM: 16, planningTriggerM: 13, central: 'Quarteiroes 1-20, 35-38, 66, 69 e 70', guapore: 'Alerta', fatima: 'Quarteiroes 78-81' },
  { levelM: 18, planningTriggerM: 15, central: 'Quarteiroes 23, 34, 41, 47-49, 51-54, 67 e 68', guapore: 'Quarteiroes 1 e 6', fatima: 'Quarteiroes 71-73' },
  { levelM: 20, planningTriggerM: 17, central: 'Quarteiroes 22, 24, 39, 40, 44-46, 50, 55, 57-60 e 62-65', guapore: 'Quarteiroes 2 e 7', fatima: 'Alerta' },
  { levelM: 22, planningTriggerM: 19, central: 'Territorio evacuado', guapore: 'Territorio evacuado', fatima: 'Quarteiroes 71 e 76' },
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
  { name: 'Salao Comunitario Bras Charleo', capacity: 60, families: 15, address: 'Linha Bras Charleo - Interior' },
] as const;

export const meetingPoints = [
  { name: 'Hospital Beneficente Nossa Senhora Aparecida', capacity: 100 },
  { name: 'Posto Sander', capacity: 100 },
] as const;

export const contingencyRoutes: ContingencyRoute[] = [
  { name: 'Rota 01 - Proximidades da Olaria Deconto', access: 'Pavimentada e pedestres', originDestination: 'Rua Julio Zarpelon, Curtume CBR, Av. Borges de Medeiros e CTG', distanceM: 1000, estimatedMinutes: 20, unavailableAtM: 20 },
  { name: 'Rota 02 - Igreja Matriz, Centro e Fatima', access: 'Pavimentada e pedestres', originDestination: 'Igreja Matriz, General Osorio, RS-129 e Cidade Alta', distanceM: 3000, estimatedMinutes: 35, unavailableAtM: null },
  { name: 'Rota 03 - Saida do Bairro Fatima', access: 'Pavimentada e pedestres', originDestination: 'Av. Sao Cristovao, RS-129 e Salao Cidade Alta', distanceM: 2500, estimatedMinutes: 30, unavailableAtM: 20 },
  { name: 'Rota 04 - Avenida Santa Lucia', access: 'Pavimentada e mista', originDestination: 'Estacao Ferroviaria, Jose Marcolin e RS-129', distanceM: 8000, estimatedMinutes: 30, unavailableAtM: 22 },
  { name: 'Rota 05 - Estacao Ferroviaria pelos trilhos', access: 'Trilha e pedestres', originDestination: 'Estacao, Jose Marcolin, Hospital e RS-129', distanceM: 500, estimatedMinutes: 15, unavailableAtM: null },
  { name: 'Rota 06 - Saida da cidade', access: 'Pavimentada e mista', originDestination: 'Hospital, Rua Presidente Kennedy e RS-129', distanceM: 2000, estimatedMinutes: 20, unavailableAtM: null },
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
