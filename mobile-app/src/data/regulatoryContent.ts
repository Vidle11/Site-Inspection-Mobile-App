export interface RegulationSnapshot {
  currentNccVersion: string;
  currentNccEffectiveDate: string;
  nextEditionPreview: string;
  nextEditionPreviewReleaseDate: string;
  nextEditionLikelyAdoptionDate: string;
  notes: string[];
}

export interface FindingTemplate {
  id: string;
  label: string;
  defaultChecklistKey: string;
  defaultTitle: string;
  defaultPrompt: string;
  referenceSummary: string;
}

export const REGULATION_SNAPSHOT: RegulationSnapshot = {
  currentNccVersion: 'NCC 2022 Amendment 2',
  currentNccEffectiveDate: '2025-07-29',
  nextEditionPreview: 'NCC 2025 preview',
  nextEditionPreviewReleaseDate: '2026-02-01',
  nextEditionLikelyAdoptionDate: '2026-05-01 (jurisdiction-dependent)',
  notes: [
    'BCA naming is legacy terminology. Current code is NCC (Volumes One, Two and Three).',
    'States and territories may vary adoption dates and apply local variations.'
  ]
};

export const TYPICAL_FINDING_TEMPLATES: FindingTemplate[] = [
  {
    id: 'waterproofing-wet-area',
    label: 'Waterproofing - wet areas',
    defaultChecklistKey: 'WATERPROOFING.WET_AREAS',
    defaultTitle: 'Wet area waterproofing non-conformance',
    defaultPrompt:
      'Observed incomplete/defective wet area waterproofing. Record substrate prep, membrane continuity, upturn heights, penetrations, and transitions at junctions.',
    referenceSummary: 'NCC 2022 Amd 2 - Health and amenity / water management provisions (relevant volume by class).'
  },
  {
    id: 'fire-penetration',
    label: 'Fire stopping - service penetrations',
    defaultChecklistKey: 'FIRE.PENETRATIONS',
    defaultTitle: 'Unsealed fire-rated penetration',
    defaultPrompt:
      'Observed service penetration through fire-resisting element without compliant fire stopping. Capture both sides of wall/floor and product identification.',
    referenceSummary: 'NCC Volume One - fire resistance and protection of openings/penetrations.'
  },
  {
    id: 'egress-obstruction',
    label: 'Egress - path obstruction',
    defaultChecklistKey: 'ACCESS_EGRESS.PATHS',
    defaultTitle: 'Egress path obstruction',
    defaultPrompt:
      'Egress path or exit access appears obstructed/non-compliant. Record clear widths, door swing impacts, and any storage/building elements reducing travel path.',
    referenceSummary: 'NCC Volume One Section D - Access and egress.'
  },
  {
    id: 'balustrade-fall',
    label: 'Balustrades and fall protection',
    defaultChecklistKey: 'SAFETY.FALL_PROTECTION',
    defaultTitle: 'Balustrade/fall protection concern',
    defaultPrompt:
      'Observed balustrade, guarding, or opening detail that may not satisfy fall protection requirements. Capture height, openings, and edge condition.',
    referenceSummary: 'NCC provisions for barriers, stair/landing safety, and fall prevention (relevant volume by class).'
  },
  {
    id: 'stairs-handrails',
    label: 'Stairs, risers, treads, handrails',
    defaultChecklistKey: 'ACCESS_EGRESS.STAIRS',
    defaultTitle: 'Stair or handrail non-conformance',
    defaultPrompt:
      'Observed non-uniform riser/tread, missing handrail, or unsafe stair geometry. Record dimensions and transition points.',
    referenceSummary: 'NCC access and movement provisions for stairways (relevant volume by class).'
  },
  {
    id: 'smoke-alarm-placement',
    label: 'Smoke alarms - location/installation',
    defaultChecklistKey: 'FIRE.SMOKE_ALARMS',
    defaultTitle: 'Smoke alarm installation issue',
    defaultPrompt:
      'Smoke alarm location, interconnection, or installation appears non-compliant. Record model detail, location relative to bedrooms/hallways, and power source.',
    referenceSummary: 'NCC residential fire safety requirements (Volume Two for Class 1 and associated classes).'
  },
  {
    id: 'accessibility-sanitary',
    label: 'Accessibility - sanitary facility',
    defaultChecklistKey: 'ACCESSIBILITY.SANITARY',
    defaultTitle: 'Accessible sanitary facility issue',
    defaultPrompt:
      'Observed accessible sanitary facility dimension, circulation space, fixture position, or hardware detail potentially non-compliant.',
    referenceSummary: 'NCC accessibility provisions and referenced standards (verify jurisdictional variations).'
  },
  {
    id: 'ventilation-indoor-air',
    label: 'Ventilation / indoor air',
    defaultChecklistKey: 'AMENITY.VENTILATION',
    defaultTitle: 'Ventilation/air quality concern',
    defaultPrompt:
      'Observed inadequate natural/mechanical ventilation condition. Record room type, opening area, fan/duct setup, and any moisture/condensation signs.',
    referenceSummary: 'NCC Health and amenity provisions (ventilation and moisture-related performance).'
  },
  {
    id: 'energy-envelope',
    label: 'Energy efficiency - building envelope',
    defaultChecklistKey: 'ENERGY.BUILDING_ENVELOPE',
    defaultTitle: 'Energy efficiency evidence gap',
    defaultPrompt:
      'Observed potential mismatch between installed envelope elements and approved energy compliance documents (insulation, glazing, sealing, shading).',
    referenceSummary: 'NCC energy efficiency requirements (edition and climate zone specific).'
  },
  {
    id: 'water-ingress-envelope',
    label: 'Envelope water ingress risk',
    defaultChecklistKey: 'ENVELOPE.WATER_INGRESS',
    defaultTitle: 'Potential water ingress defect',
    defaultPrompt:
      'Observed detailing likely to permit water ingress (flashing, sill, jointing, drainage path, termination). Capture upstream and downstream details.',
    referenceSummary: 'NCC weatherproofing and water management outcomes (class and volume dependent).'
  },
  {
    id: 'site-drainage',
    label: 'Site drainage / stormwater',
    defaultChecklistKey: 'SITE.DRAINAGE',
    defaultTitle: 'Site drainage issue',
    defaultPrompt:
      'Observed site drainage grading, discharge, or stormwater arrangement that may create ponding or adverse flow to building elements.',
    referenceSummary: 'NCC Volume Three plumbing and drainage + local authority requirements.'
  },
  {
    id: 'documentation-mismatch',
    label: 'As-built vs approved docs mismatch',
    defaultChecklistKey: 'DOCUMENTATION.AS_BUILT',
    defaultTitle: 'As-built deviation from approved documents',
    defaultPrompt:
      'Observed constructed condition differs from approved design or specifications. Record affected location, variation scope, and supporting evidence.',
    referenceSummary: 'Compliance pathway verification under NCC and jurisdictional building legislation.'
  }
];
