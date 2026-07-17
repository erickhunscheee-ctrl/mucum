import { getMucumMunicipality, supabase } from './supabase';

export type LocalAdminEntity = 'neighborhoods' | 'shelters' | 'escape_routes' | 'critical_points';

export type LocalAdminRecord = Record<string, unknown> & {
  id?: string;
  name?: string;
  is_active?: boolean;
};

export type LocalAdminForm = {
  id?: string;
  name: string;
  neighborhood_id: string;
  shelter_id: string;
  street_id: string;
  address: string;
  capacity: string;
  contact_name: string;
  contact_phone: string;
  whatsapp: string;
  origin_description: string;
  destination_description: string;
  route_url: string;
  distance_m: string;
  closes_at_river_level_m: string;
  starts_flooding_at_m: string;
  blocks_route_at_m: string;
  description: string;
  notes: string;
  is_active: boolean;
};

export const emptyLocalAdminForm: LocalAdminForm = {
  name: '',
  neighborhood_id: '',
  shelter_id: '',
  street_id: '',
  address: '',
  capacity: '',
  contact_name: '',
  contact_phone: '',
  whatsapp: '',
  origin_description: '',
  destination_description: '',
  route_url: '',
  distance_m: '',
  closes_at_river_level_m: '',
  starts_flooding_at_m: '',
  blocks_route_at_m: '',
  description: '',
  notes: '',
  is_active: true,
};

export const localAdminEntities: { key: LocalAdminEntity; label: string; description: string }[] = [
  {
    key: 'neighborhoods',
    label: 'Bairros',
    description: 'Base para vincular moradores, abrigos, rotas e alertas segmentados.',
  },
  {
    key: 'shelters',
    label: 'Abrigos',
    description: 'Locais de acolhimento usados pelo app e pela operacao.',
  },
  {
    key: 'escape_routes',
    label: 'Rotas de fuga',
    description: 'Caminhos seguros por bairro e a cota em que deixam de ser recomendados.',
  },
  {
    key: 'critical_points',
    label: 'Pontos criticos',
    description: 'Ruas, pontes e locais que alagam ou bloqueiam conforme a cota.',
  },
];

export async function listLocalAdminRecords(entity: LocalAdminEntity) {
  const municipality = await getMucumMunicipality();
  const { data, error } = await dynamicTable()
    .from(entity)
    .select(getSelectColumns(entity))
    .eq('municipality_id', municipality.id)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as LocalAdminRecord[];
}

export async function saveLocalAdminRecord(entity: LocalAdminEntity, form: LocalAdminForm) {
  const municipality = await getMucumMunicipality();
  const payload = buildPayload(entity, form, municipality.id);
  const query = dynamicTable().from(entity);
  const { data, error } = form.id
    ? await query.update(payload).eq('id', form.id).select(getSelectColumns(entity)).single()
    : await query.insert(payload).select(getSelectColumns(entity)).single();

  if (error) {
    throw error;
  }

  return data as LocalAdminRecord;
}

function dynamicTable() {
  return supabase as unknown as {
    from: (table: LocalAdminEntity) => {
      select: (columns?: string) => {
        eq: (column: string, value: unknown) => {
          order: (column: string, options?: { ascending?: boolean }) => Promise<{ data: unknown[] | null; error: Error | null }>;
        };
      };
      update: (payload: Record<string, unknown>) => {
        eq: (column: string, value: unknown) => {
          select: (columns?: string) => {
            single: () => Promise<{ data: unknown | null; error: Error | null }>;
          };
        };
      };
      insert: (payload: Record<string, unknown>) => {
        select: (columns?: string) => {
          single: () => Promise<{ data: unknown | null; error: Error | null }>;
        };
      };
    };
  };
}

export function formFromRecord(record: LocalAdminRecord): LocalAdminForm {
  return {
    ...emptyLocalAdminForm,
    id: stringValue(record.id),
    name: stringValue(record.name),
    neighborhood_id: stringValue(record.neighborhood_id),
    shelter_id: stringValue(record.shelter_id),
    street_id: stringValue(record.street_id),
    address: stringValue(record.address),
    capacity: stringValue(record.capacity),
    contact_name: stringValue(record.contact_name),
    contact_phone: stringValue(record.contact_phone),
    whatsapp: stringValue(record.whatsapp),
    origin_description: stringValue(record.origin_description),
    destination_description: stringValue(record.destination_description),
    route_url: stringValue(record.route_url),
    distance_m: stringValue(record.distance_m),
    closes_at_river_level_m: stringValue(record.closes_at_river_level_m),
    starts_flooding_at_m: stringValue(record.starts_flooding_at_m),
    blocks_route_at_m: stringValue(record.blocks_route_at_m),
    description: stringValue(record.description),
    notes: stringValue(record.notes),
    is_active: record.is_active !== false,
  };
}

function buildPayload(entity: LocalAdminEntity, form: LocalAdminForm, municipalityId: string) {
  const common = {
    municipality_id: municipalityId,
    name: form.name.trim(),
    notes: nullableString(form.notes),
  };

  if (entity === 'neighborhoods') {
    return common;
  }

  if (entity === 'shelters') {
    return {
      ...common,
      neighborhood_id: nullableString(form.neighborhood_id),
      address: nullableString(form.address),
      capacity: nullableNumber(form.capacity),
      contact_name: nullableString(form.contact_name),
      contact_phone: nullableString(form.contact_phone),
      whatsapp: nullableString(form.whatsapp),
      is_active: form.is_active,
    };
  }

  if (entity === 'escape_routes') {
    return {
      ...common,
      neighborhood_id: nullableString(form.neighborhood_id),
      shelter_id: nullableString(form.shelter_id),
      origin_description: nullableString(form.origin_description),
      destination_description: nullableString(form.destination_description),
      route_url: nullableString(form.route_url),
      distance_m: nullableNumber(form.distance_m),
      closes_at_river_level_m: nullableNumber(form.closes_at_river_level_m),
      is_active: form.is_active,
    };
  }

  return {
    ...common,
    neighborhood_id: nullableString(form.neighborhood_id),
    street_id: nullableString(form.street_id),
    description: nullableString(form.description),
    starts_flooding_at_m: nullableNumber(form.starts_flooding_at_m),
    blocks_route_at_m: nullableNumber(form.blocks_route_at_m),
  };
}

function getSelectColumns(entity: LocalAdminEntity) {
  if (entity === 'neighborhoods') {
    return 'id,name,notes,sort_order,created_at,updated_at';
  }

  if (entity === 'shelters') {
    return 'id,name,neighborhood_id,address,capacity,contact_name,contact_phone,whatsapp,is_active,notes,created_at,updated_at';
  }

  if (entity === 'escape_routes') {
    return 'id,name,neighborhood_id,shelter_id,origin_description,destination_description,route_url,distance_m,closes_at_river_level_m,is_active,notes,created_at,updated_at';
  }

  return 'id,name,neighborhood_id,street_id,description,starts_flooding_at_m,blocks_route_at_m,notes,created_at,updated_at';
}

function nullableString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function nullableNumber(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}
