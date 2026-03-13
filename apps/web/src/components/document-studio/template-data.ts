import type { DocType } from '@/lib/types';

export interface TemplateDefinition {
  id: string;
  title: string;
  docType: DocType;
  standards: string[];
  group: 'iso_9001' | 'iso_14001' | 'iso_45001' | 'multi';
  isCore: boolean;
  sections: string[];
}

export const TEMPLATE_GROUPS = [
  { value: 'all', label: 'All Templates' },
  { value: 'iso_9001', label: 'ISO 9001' },
  { value: 'iso_14001', label: 'ISO 14001' },
  { value: 'iso_45001', label: 'ISO 45001' },
  { value: 'multi', label: 'Multi-Standard' },
] as const;

export const TEMPLATES: TemplateDefinition[] = [
  // ── ISO 9001 Quality ──
  {
    id: 'qms-quality-manual',
    title: 'Quality Manual',
    docType: 'manual',
    standards: ['iso_9001'],
    group: 'iso_9001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Normative References', '4. Context of the Organization', '5. Leadership', '6. Planning', '7. Support', '8. Operation', '9. Performance Evaluation', '10. Improvement'],
  },
  {
    id: 'qms-quality-policy',
    title: 'Quality Policy',
    docType: 'policy',
    standards: ['iso_9001'],
    group: 'iso_9001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Policy Statement', '4. Commitments', '5. Communication'],
  },
  {
    id: 'qms-document-control',
    title: 'Document Control Procedure',
    docType: 'procedure',
    standards: ['iso_9001'],
    group: 'iso_9001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Responsibilities', '4. Document Creation', '5. Review & Approval', '6. Distribution & Access', '7. Revision Control', '8. Retention & Disposal'],
  },
  {
    id: 'qms-internal-audit',
    title: 'Internal Audit Procedure',
    docType: 'procedure',
    standards: ['iso_9001'],
    group: 'iso_9001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Responsibilities', '4. Audit Planning', '5. Audit Execution', '6. Reporting', '7. Follow-Up Actions'],
  },
  {
    id: 'qms-capa-procedure',
    title: 'CAPA Procedure',
    docType: 'procedure',
    standards: ['iso_9001'],
    group: 'iso_9001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Responsibilities', '4. Nonconformity Identification', '5. Root Cause Analysis', '6. Corrective Action', '7. Preventive Action', '8. Verification of Effectiveness'],
  },
  {
    id: 'qms-management-review',
    title: 'Management Review Procedure',
    docType: 'procedure',
    standards: ['iso_9001'],
    group: 'iso_9001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Responsibilities', '4. Review Inputs', '5. Review Process', '6. Review Outputs', '7. Records'],
  },
  {
    id: 'qms-training-matrix',
    title: 'Training Matrix',
    docType: 'form',
    standards: ['iso_9001'],
    group: 'iso_9001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Competence Requirements', '4. Training Plan', '5. Records & Evaluation'],
  },
  {
    id: 'qms-supplier-evaluation',
    title: 'Supplier Evaluation Form',
    docType: 'form',
    standards: ['iso_9001'],
    group: 'iso_9001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Evaluation Criteria', '4. Scoring Method', '5. Approval & Re-evaluation'],
  },

  // ── ISO 14001 Environmental ──
  {
    id: 'ems-environmental-manual',
    title: 'Environmental Management Manual',
    docType: 'manual',
    standards: ['iso_14001'],
    group: 'iso_14001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Environmental Policy', '4. Planning', '5. Implementation & Operation', '6. Checking & Corrective Action', '7. Management Review'],
  },
  {
    id: 'ems-environmental-policy',
    title: 'Environmental Policy',
    docType: 'policy',
    standards: ['iso_14001'],
    group: 'iso_14001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Policy Statement', '4. Commitments', '5. Communication'],
  },
  {
    id: 'ems-aspects-register',
    title: 'Environmental Aspects Register',
    docType: 'record',
    standards: ['iso_14001'],
    group: 'iso_14001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Identification Method', '4. Significance Evaluation', '5. Register'],
  },
  {
    id: 'ems-legal-compliance',
    title: 'Legal Compliance Register',
    docType: 'record',
    standards: ['iso_14001'],
    group: 'iso_14001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Applicable Legislation', '4. Compliance Evaluation', '5. Update Procedure'],
  },
  {
    id: 'ems-emergency-response',
    title: 'Emergency Response Procedure',
    docType: 'procedure',
    standards: ['iso_14001'],
    group: 'iso_14001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Responsibilities', '4. Emergency Scenarios', '5. Response Actions', '6. Communication', '7. Post-Incident Review'],
  },

  // ── ISO 45001 OH&S ──
  {
    id: 'ohs-manual',
    title: 'OH&S Manual',
    docType: 'manual',
    standards: ['iso_45001'],
    group: 'iso_45001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. OH&S Policy', '4. Hazard Identification', '5. Risk Assessment', '6. Operational Controls', '7. Emergency Preparedness', '8. Performance Monitoring', '9. Improvement'],
  },
  {
    id: 'ohs-policy',
    title: 'OH&S Policy',
    docType: 'policy',
    standards: ['iso_45001'],
    group: 'iso_45001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Policy Statement', '4. Commitments', '5. Worker Consultation', '6. Communication'],
  },
  {
    id: 'ohs-hazard-register',
    title: 'Hazard Identification Register',
    docType: 'record',
    standards: ['iso_45001'],
    group: 'iso_45001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Hazard Categories', '4. Identification Method', '5. Risk Rating', '6. Register'],
  },
  {
    id: 'ohs-risk-assessment',
    title: 'Risk Assessment Form',
    docType: 'form',
    standards: ['iso_45001'],
    group: 'iso_45001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Risk Identification', '4. Likelihood & Consequence', '5. Risk Rating Matrix', '6. Controls', '7. Residual Risk'],
  },
  {
    id: 'ohs-incident-investigation',
    title: 'Incident Investigation Procedure',
    docType: 'procedure',
    standards: ['iso_45001'],
    group: 'iso_45001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. Responsibilities', '4. Incident Classification', '5. Investigation Process', '6. Root Cause Analysis', '7. Corrective Actions', '8. Reporting'],
  },
  {
    id: 'ohs-ppe-register',
    title: 'PPE Register',
    docType: 'record',
    standards: ['iso_45001'],
    group: 'iso_45001',
    isCore: false,
    sections: ['1. Purpose', '2. Scope', '3. PPE Categories', '4. Issue & Replacement', '5. Inspection & Maintenance', '6. Register'],
  },

  // ── Multi-Standard (Annex SL) ──
  {
    id: 'ims-integrated-manual',
    title: 'Integrated Management System Manual',
    docType: 'manual',
    standards: ['iso_9001', 'iso_14001', 'iso_45001'],
    group: 'multi',
    isCore: true,
    sections: ['1. Purpose', '2. Scope', '3. Normative References', '4. Context of the Organization', '5. Leadership', '6. Planning', '7. Support', '8. Operation', '9. Performance Evaluation', '10. Improvement', 'Annex SL Clause Reference'],
  },
  {
    id: 'ims-organizational-context',
    title: 'Organizational Context (Clause 4.1)',
    docType: 'record',
    standards: ['iso_9001', 'iso_14001', 'iso_45001'],
    group: 'multi',
    isCore: true,
    sections: ['1. Purpose', '2. Scope', '3. Internal Issues', '4. External Issues', '5. SWOT Analysis', 'Annex SL Clause Reference'],
  },
  {
    id: 'ims-interested-parties',
    title: 'Interested Parties Register (Clause 4.2)',
    docType: 'record',
    standards: ['iso_9001', 'iso_14001', 'iso_45001'],
    group: 'multi',
    isCore: true,
    sections: ['1. Purpose', '2. Scope', '3. Identification of Interested Parties', '4. Requirements & Expectations', '5. Review & Update', 'Annex SL Clause Reference'],
  },
  {
    id: 'ims-objectives-register',
    title: 'Objectives Register (Clause 6.2)',
    docType: 'record',
    standards: ['iso_9001', 'iso_14001', 'iso_45001'],
    group: 'multi',
    isCore: true,
    sections: ['1. Purpose', '2. Scope', '3. Objectives by Standard', '4. Targets & KPIs', '5. Action Plans', '6. Monitoring & Review', 'Annex SL Clause Reference'],
  },
  {
    id: 'ims-competence-training',
    title: 'Competence & Training Record (Clause 7.2)',
    docType: 'record',
    standards: ['iso_9001', 'iso_14001', 'iso_45001'],
    group: 'multi',
    isCore: true,
    sections: ['1. Purpose', '2. Scope', '3. Competence Requirements', '4. Training Needs Analysis', '5. Training Delivery', '6. Effectiveness Evaluation', 'Annex SL Clause Reference'],
  },
  {
    id: 'ims-management-review-minutes',
    title: 'Management Review Minutes (Clause 9.3)',
    docType: 'record',
    standards: ['iso_9001', 'iso_14001', 'iso_45001'],
    group: 'multi',
    isCore: true,
    sections: ['1. Purpose', '2. Scope', '3. Review Inputs', '4. Discussion & Decisions', '5. Action Items', '6. Review Outputs', 'Annex SL Clause Reference'],
  },
];

/** Generate minimal TipTap JSON for a template */
export function generateTiptapJson(template: TemplateDefinition): Record<string, unknown> {
  const content: Record<string, unknown>[] = [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: template.title }],
    },
  ];

  for (const section of template.sections) {
    content.push(
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: section }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: ' ' }],
      },
    );
  }

  return { type: 'doc', content };
}
