export const ACQUISITION_TYPE_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'trade', label: 'Trade' },
  { value: 'free_agency', label: 'Free Agency' },
  { value: 'waivers', label: 'Waivers' },
  { value: 'foundational_signing', label: 'Foundational Signing' },
  { value: 'expansion_signing', label: 'Expansion Signing' },
  { value: 'expansion_draft', label: 'Expansion Draft' },
  { value: 'team_transfer', label: 'Team Transfer' },
  { value: 'loan', label: 'Loan' },
  { value: 'other', label: 'Other' },
];

export const ACQUISITION_TYPE_LABELS = Object.fromEntries(
  ACQUISITION_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<string, string>;
