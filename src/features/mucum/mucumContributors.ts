import contributorCatalogJson from '../../../shared/mucum-contributors.json';

export type ContributorRelation =
  | 'main_upstream'
  | 'tributary_upstream'
  | 'local_critical'
  | 'local_drainage'
  | 'outlet';

export type ContributorInfluence = 'very_high' | 'high' | 'medium';

export type MucumContributor = {
  key: string;
  name: string;
  relation: ContributorRelation;
  influence: ContributorInfluence;
  priority: number;
  description: string;
  riverPatterns: string[];
  cities: string[];
};

export type ContributorPriorityGroup = {
  key: string;
  name: string;
  contributorKeys: string[];
  description: string;
  priorityLabel: string;
};

export type DownstreamContext = {
  key: string;
  name: string;
  description: string;
};

export const mucumContributorCatalog = contributorCatalogJson as {
  contributors: MucumContributor[];
  priorityGroups: ContributorPriorityGroup[];
  downstreamContext: DownstreamContext[];
};

export function contributorMatchesLocation(contributor: MucumContributor, city: string, river = '') {
  const normalizedCity = normalizeHydroName(city);
  const normalizedRiver = normalizeHydroName(river);
  return contributor.riverPatterns.some((pattern) => normalizedRiver.includes(normalizeHydroName(pattern)))
    || contributor.cities.some((candidate) => normalizeHydroName(candidate) === normalizedCity);
}

export function contributorForLocation(city: string, river = '') {
  return mucumContributorCatalog.contributors.find((contributor) => (
    contributorMatchesLocation(contributor, city, river)
  )) ?? null;
}

export function normalizeHydroName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}
