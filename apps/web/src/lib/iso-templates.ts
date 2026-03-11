/**
 * iso-templates.ts — Client-side ISO document template generator.
 * When the AI backend is unavailable, generates structured ISO-compliant
 * document templates based on document type, standards, sections.
 * Outputs plain text (for wizard preview) and TipTap ProseMirror JSON.
 */

export interface TemplateConfig {
  documentType: string;
  standards: string[];
  orgContext: string;
  sections: string[];
  title?: string;
}

export interface TemplateResult {
  content: string;
  clauseRefs: string[];
  bodyJsonb: Record<string, unknown>;
}

const STD: Record<string, string> = {
  iso_9001: 'ISO 9001:2015',
  iso_14001: 'ISO 14001:2015',
  iso_45001: 'ISO 45001:2018',
};

const STD_FULL: Record<string, string> = {
  iso_9001: 'ISO 9001:2015 Quality Management Systems',
  iso_14001: 'ISO 14001:2015 Environmental Management Systems',
  iso_45001: 'ISO 45001:2018 Occupational Health and Safety Management Systems',
};

const SECTION_CLAUSES: Record<string, string[]> = {
  Purpose: ['5.2', '4.1'],
  Scope: ['4.3'],
  'Policy Statement': ['5.2'],
  Definitions: ['3.1'],
  Responsibilities: ['5.3'],
  'Procedure Steps': ['8.1'],
  Records: ['7.5'],
  References: ['7.5'],
  Review: ['9.3', '10.2'],
  'Context of the Organisation': ['4.1', '4.2'],
  Leadership: ['5.1', '5.2', '5.3'],
  Planning: ['6.1', '6.2'],
  Support: ['7.1', '7.2', '7.3', '7.4', '7.5'],
  Operation: ['8.1', '8.2'],
  'Performance Evaluation': ['9.1', '9.2', '9.3'],
  Improvement: ['10.1', '10.2'],
  Introduction: ['4.1'],
  'Normative References': ['2.0'],
  'Terms & Definitions': ['3.1'],
  Objective: ['6.2'],
  Activities: ['8.1'],
  Timeline: ['6.2'],
  Resources: ['7.1'],
  Monitoring: ['9.1'],
  'Safety Precautions': ['8.1'],
  'Equipment & Materials': ['7.1'],
  'Step-by-Step Instructions': ['8.1'],
  Verification: ['8.6', '9.1'],
};

function stdList(standards: string[]): string {
  return standards.map((s) => STD[s] ?? s).join(', ');
}

type SectionGen = (dt: string, stds: string[], org: string, t: string) => string;

const GENS: Record<string, SectionGen> = {
  Purpose: (dt, stds, org, t) =>
    `This ${dt.toLowerCase()} defines the framework and requirements for ${t ? t.toLowerCase() : 'the associated management system processes'} within ${org}.\n\nThe purpose is to ensure consistent, effective and compliant operations in accordance with ${stdList(stds)}. This document supports the organisation commitment to continual improvement, stakeholder satisfaction, and regulatory compliance.\n\nSpecifically, this document aims to:\n  - Establish clear processes and controls\n  - Define roles, responsibilities, and authorities\n  - Ensure conformity with applicable ${stdList(stds)} requirements\n  - Provide a basis for performance monitoring and improvement`,

  Scope: (_dt, stds, org) =>
    `This document applies to all processes, activities, products, and services within the scope of the ${org} management system.\n\nApplicability:\n  - All departments, functions, and operational sites\n  - All personnel, contractors, and relevant interested parties\n  - All processes within the ${stdList(stds)} management system scope\n\nExclusions: Any exclusions to the scope shall be documented and justified in accordance with Clause 4.3.`,

  'Policy Statement': (_dt, stds, org) =>
    `${org} is committed to establishing, implementing, maintaining, and continually improving its management system in accordance with ${stdList(stds)}.\n\nManagement commits to:\n  - Providing a framework for setting and reviewing objectives\n  - Meeting applicable legal, regulatory, and other requirements\n  - Continual improvement of the management system effectiveness\n  - Ensuring availability of resources necessary for the management system\n  - Communicating the policy to all relevant parties\n\nThis policy shall be reviewed at planned intervals to ensure its continuing suitability, adequacy, and effectiveness.`,

  Definitions: (_dt, stds) =>
    `The following terms and definitions apply to this document:\n\n  - Management System: Set of interrelated or interacting elements of an organisation to establish policies, objectives, and processes to achieve those objectives\n  - Documented Information: Information required to be controlled and maintained, and the medium on which it is contained\n  - Nonconformity: Non-fulfilment of a requirement\n  - Corrective Action: Action to eliminate the cause of a nonconformity and to prevent recurrence\n  - Continual Improvement: Recurring activity to enhance performance\n  - Competence: Ability to apply knowledge and skills to achieve intended results\n  - Interested Party: Person or organisation that can affect, be affected by, or perceive itself to be affected by a decision or activity\n  - Risk: Effect of uncertainty on objectives\n  - Process: Set of interrelated or interacting activities which transforms inputs to outputs\n\nFor additional terminology, refer to ${stdList(stds)} and ISO 9000:2015 Fundamentals and vocabulary.`,

  Responsibilities: (_dt, _stds, org) =>
    `The following roles and responsibilities are defined for this document:\n\nTop Management:\n  - Ensure the management system achieves its intended outcomes\n  - Ensure integration of management system requirements into business processes\n  - Promote the use of the process approach and risk-based thinking\n  - Ensure resources are available for the management system\n\nManagement Representative / Quality Manager:\n  - Maintain and coordinate the management system documentation\n  - Report on management system performance to top management\n  - Ensure promotion of awareness of applicable requirements\n  - Coordinate internal audits and management reviews\n\nProcess Owners:\n  - Implement and maintain processes within their area of responsibility\n  - Monitor process performance and identify improvement opportunities\n  - Ensure personnel are competent and trained for their roles\n\nAll Personnel of ${org}:\n  - Comply with applicable management system requirements\n  - Report nonconformities and improvement opportunities\n  - Participate in training and awareness activities`,

  'Procedure Steps': (dt, stds, _org, t) =>
    `The following procedure shall be followed for ${t ? t.toLowerCase() : 'this ' + dt.toLowerCase()}:\n\nStep 1 - Initiation\nIdentify the need for this process activity. Document the trigger event, inputs required, and expected outputs. Assign responsibility to the appropriate process owner.\n\nStep 2 - Planning\nDetermine the resources, competencies, and timeframes required. Identify applicable ${stdList(stds)} requirements and any legal or regulatory obligations. Conduct a risk assessment where appropriate.\n\nStep 3 - Execution\nCarry out the planned activities in accordance with established controls. Ensure all personnel involved are aware of their responsibilities and the relevant documented information is available.\n\nStep 4 - Verification\nMonitor and measure the outputs against planned arrangements. Verify conformity with the defined acceptance criteria. Document any deviations or nonconformities identified.\n\nStep 5 - Review and Release\nReview the results with the process owner. Obtain necessary approvals before release. Ensure all records are completed and filed in accordance with Clause 7.5.\n\nStep 6 - Continual Improvement\nAnalyse process performance data. Identify opportunities for improvement. Implement corrective actions where nonconformities are identified (Clause 10.1). Update this procedure as required following management review.`,

  Records: () =>
    `The following records shall be created, maintained, and retained as evidence of conformity:\n\n  - Process execution records: retained for minimum 3 years\n  - Approval and authorisation records: retained for minimum 5 years\n  - Nonconformity and corrective action records: retained for minimum 5 years\n  - Training and competence records: retained for duration of employment + 2 years\n  - Monitoring and measurement results: retained for minimum 3 years\n  - Management review outputs: retained for minimum 5 years\n\nRecords shall be:\n  - Legible, identifiable, and retrievable\n  - Protected from damage, deterioration, or loss\n  - Stored in the organisation document management system\n  - Disposed of in accordance with the retention schedule\n\nRecord retention periods shall comply with applicable legal, regulatory, and contractual requirements.`,

  References: (_dt, stds) =>
    `The following documents are referenced in this procedure:\n\n${stds.map((s) => '  - ' + (STD_FULL[s] ?? s)).join('\n')}\n  - ISO 9000:2015 Quality management systems - Fundamentals and vocabulary\n  - ISO 19011:2018 Guidelines for auditing management systems\n  - Organisation Quality Manual\n  - Document Control Procedure\n  - Internal Audit Procedure\n  - Corrective Action Procedure\n  - Risk Management Procedure\n\nAll referenced documents shall be available at the point of use and controlled in accordance with documented information requirements (Clause 7.5).`,

  Review: () =>
    `This document shall be reviewed at the following intervals:\n\n  - At least annually as part of the management review process (Clause 9.3)\n  - Following significant changes to processes, products, or services\n  - Following internal or external audit findings related to this procedure\n  - Following changes in applicable legal or regulatory requirements\n  - When nonconformities indicate a systemic issue with this procedure\n\nReview shall be conducted by the process owner and approved by the Management Representative.`,

  'Context of the Organisation': (_dt, _stds, org) =>
    `${org} has determined the external and internal issues relevant to its purpose and strategic direction.\n\nExternal Context:\n  - Market conditions and competitive landscape\n  - Legal, regulatory, and statutory requirements\n  - Technological developments and innovation\n  - Stakeholder expectations and requirements\n\nInternal Context:\n  - Organisational structure and governance\n  - Available resources and capabilities\n  - Organisational knowledge and competencies\n  - Culture, values, and performance standards`,

  Leadership: (_dt, _stds, org) =>
    `Top management of ${org} demonstrates leadership and commitment by:\n\n  - Taking accountability for the effectiveness of the management system\n  - Ensuring the policy and objectives are established and compatible with the strategic direction\n  - Ensuring integration of management system requirements into business processes\n  - Promoting the use of the process approach and risk-based thinking\n  - Ensuring resources needed for the management system are available\n  - Directing and supporting persons to contribute to effectiveness\n  - Promoting continual improvement`,

  Planning: (_dt, stds) =>
    `When planning for the management system, the organisation shall consider the issues referred to in Clause 4.1 and Clause 4.2.\n\nRisk-based Planning (Clause 6.1):\n  - Identify risks and opportunities for each process\n  - Assess potential impacts on conformity\n  - Determine actions to address identified risks and opportunities\n  - Evaluate the effectiveness of actions taken\n\nManagement System Objectives (Clause 6.2):\n  - Objectives shall be consistent with the policy\n  - Objectives shall be measurable, monitored, communicated, and updated\n  - Planning to achieve objectives shall determine: what, resources, responsible, timeline, evaluation\n\nApplicable standards: ${stdList(stds)}`,

  Support: (_dt, _stds, org) =>
    `${org} shall determine and provide the resources needed for the management system.\n\nResources (Clause 7.1): Personnel, infrastructure, process environment, monitoring resources, organisational knowledge\n\nCompetence (Clause 7.2): Determine necessary competence, ensure training, evaluate effectiveness\n\nAwareness (Clause 7.3): Personnel shall be aware of the policy, objectives, their contribution, and implications of nonconformity\n\nCommunication (Clause 7.4): Determine internal and external communications: what, when, with whom, how\n\nDocumented Information (Clause 7.5): Include required documented information, control for adequacy and availability`,

  Operation: (dt, stds, _org, t) =>
    `The organisation shall plan, implement, and control the processes needed in accordance with ${stdList(stds)}.\n\nOperational Planning and Control (Clause 8.1):\n  - Determine requirements for ${t ? t.toLowerCase() : 'this ' + dt.toLowerCase()}\n  - Establish criteria for processes and acceptance\n  - Determine resources needed to achieve conformity\n  - Implement control of processes in accordance with criteria\n  - Maintain documented information\n\nThe organisation shall control planned changes and review the consequences of unintended changes.`,

  'Performance Evaluation': (_dt, stds, org) =>
    `${org} shall determine what needs to be monitored and measured.\n\nMonitoring and Measurement (Clause 9.1): KPIs for each process, customer satisfaction, conformity\n\nInternal Audit (Clause 9.2): Conduct at planned intervals per ISO 19011, cover all ${stdList(stds)} requirements\n\nManagement Review (Clause 9.3): Review at planned intervals, consider actions/changes/trends, output decisions on improvement`,

  Improvement: (_dt, _stds, org) =>
    `${org} shall determine and select opportunities for improvement.\n\nNonconformity and Corrective Action (Clause 10.1):\n  - React to nonconformities: control, correct, deal with consequences\n  - Evaluate need for root cause analysis\n  - Implement corrective action\n  - Review effectiveness of actions taken\n\nContinual Improvement (Clause 10.2):\n  - Continually improve suitability, adequacy, and effectiveness\n  - Consider analysis results and management review outputs\n  - Address areas for improvement through the PDCA cycle`,

  Introduction: (_dt, stds, org) =>
    `This document is part of ${org} integrated management system established in accordance with ${stds.map((s) => STD_FULL[s] ?? s).join('; ')}.\n\nIt provides the documented framework that defines the structure, processes, and procedures for effective management system implementation and continual improvement.`,

  'Normative References': (_dt, stds) =>
    `The following normative references are indispensable for the application of this document:\n\n${stds.map((s) => '  - ' + (STD_FULL[s] ?? s)).join('\n')}\n  - ISO 9000:2015 Quality management systems - Fundamentals and vocabulary\n  - ISO 19011:2018 Guidelines for auditing management systems`,

  'Terms & Definitions': () =>
    'For the purposes of this document, the terms and definitions given in ISO 9000:2015 and the following apply.',

  Objective: (_dt, _stds, _org, t) =>
    `The objective of ${t ? 'this ' + t.toLowerCase() : 'this plan'} is to establish a structured approach for achieving defined targets.\n\nObjectives shall be:\n  - Specific: clearly defined and unambiguous\n  - Measurable: quantifiable with defined success criteria\n  - Achievable: realistic given available resources\n  - Relevant: aligned with policy and strategic direction\n  - Time-bound: with defined completion dates and milestones`,

  Activities: (_dt, stds) =>
    `The following activities shall be undertaken:\n\nPhase 1 - Assessment and Planning\n  - Review current state against ${stdList(stds)} requirements\n  - Identify gaps and areas for improvement\n  - Develop detailed action plans\n\nPhase 2 - Implementation\n  - Execute planned activities in accordance with established procedures\n  - Provide necessary training and resources\n  - Monitor progress against milestones\n\nPhase 3 - Verification and Closure\n  - Verify completion of all planned activities\n  - Evaluate effectiveness of actions taken\n  - Document lessons learned`,

  Timeline: () =>
    `Key milestones and target dates:\n\n  - Initiation and planning: [Target Date]\n  - Resource allocation: [Target Date]\n  - Implementation start: [Target Date]\n  - Mid-point review: [Target Date]\n  - Completion of activities: [Target Date]\n  - Final review and sign-off: [Target Date]\n\nProgress shall be reviewed at defined intervals and reported to management.`,

  Resources: (_dt, _stds, org) =>
    `${org} shall determine and provide the following resources:\n\n  - Personnel: competent individuals assigned to each activity\n  - Infrastructure: equipment, facilities, and IT systems\n  - Financial: budget allocation for planned activities\n  - External: consultants, contractors, or suppliers as required\n  - Knowledge: access to relevant standards, procedures, and training materials`,

  Monitoring: () =>
    `Monitoring and measurement shall be conducted to ensure effectiveness:\n\n  - Key Performance Indicators (KPIs) shall be defined for each objective\n  - Data shall be collected at defined intervals\n  - Results shall be analysed for trends and patterns\n  - Deviations from targets shall trigger corrective action\n  - Monitoring results shall be reported in management reviews`,

  'Safety Precautions': () =>
    `Before commencing work, the following safety precautions shall be observed:\n\n  - Review applicable risk assessments and safe work method statements\n  - Ensure all required personal protective equipment (PPE) is available\n  - Verify that equipment is in safe working order with current calibration records\n  - Confirm emergency procedures are understood and emergency equipment is accessible\n  - Report any unsafe conditions or near-misses immediately`,

  'Equipment & Materials': () =>
    `The following equipment and materials are required:\n\n  - [List specific equipment required]\n  - [List materials and consumables required]\n  - [List calibrated measuring instruments required]\n  - [List required PPE]\n\nAll equipment shall be maintained in accordance with the preventive maintenance schedule.`,

  'Step-by-Step Instructions': () =>
    `Follow these instructions in sequence:\n\n1. Preparation - Gather all required materials, equipment, and documentation.\n2. Setup - Configure equipment and environment as specified.\n3. Execution - Perform the work activities as documented. Follow all safety requirements.\n4. Inspection - Inspect the output against acceptance criteria. Record results.\n5. Completion - Clean and restore the work area. Complete all required records.`,

  Verification: () =>
    `Verification activities shall confirm that outputs meet specified requirements:\n\n  - Visual inspection against acceptance criteria\n  - Measurement and testing as defined in the quality plan\n  - Review of records and documented information\n  - Sign-off by authorised personnel\n\nAny nonconforming outputs shall be identified, segregated, and processed in accordance with the nonconformity procedure.`,
};

function generateSectionText(section: string, docType: string, standards: string[], org: string, title: string): string {
  const gen = GENS[section];
  if (gen) return gen(docType, standards, org, title);
  return `This section addresses ${section.toLowerCase()} requirements within the ${docType.toLowerCase()} framework.\n\nKey considerations:\n  - Alignment with ${stdList(standards)} requirements\n  - Integration with existing management system processes\n  - Documented information and record-keeping requirements\n  - Roles, responsibilities, and competencies\n\n[Complete this section with organisation-specific details]`;
}

// TipTap JSON helpers

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

function tn(t: string, bold = false): TipTapNode {
  const n: TipTapNode = { type: 'text', text: t };
  if (bold) n.marks = [{ type: 'bold' }];
  return n;
}

function h(level: 1 | 2 | 3, t: string): TipTapNode {
  return { type: 'heading', attrs: { level }, content: [tn(t)] };
}

function p(t: string): TipTapNode {
  if (!t.trim()) return { type: 'paragraph' };
  return { type: 'paragraph', content: [tn(t)] };
}

function bl(items: string[]): TipTapNode {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [tn(item.replace(/^\s*[-]\s*/, ''))] }],
    })),
  };
}

function sectionToNodes(secTitle: string, secText: string, idx: number): TipTapNode[] {
  const nodes: TipTapNode[] = [];
  nodes.push(h(2, `${idx + 1}. ${secTitle}`));

  const lines = secText.split('\n');
  let bullets: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (bullets.length > 0) { nodes.push(bl(bullets)); bullets = []; }
      continue;
    }
    if (trimmed.startsWith('-') && trimmed.length > 2) {
      bullets.push(trimmed);
    } else if (/^\d+\.\s/.test(trimmed) || /^Step \d+/.test(trimmed) || /^Phase \d+/.test(trimmed)) {
      if (bullets.length > 0) { nodes.push(bl(bullets)); bullets = []; }
      nodes.push({ type: 'paragraph', content: [tn(trimmed, true)] });
    } else if (trimmed.endsWith(':') && trimmed.length < 80) {
      if (bullets.length > 0) { nodes.push(bl(bullets)); bullets = []; }
      nodes.push({ type: 'paragraph', content: [tn(trimmed, true)] });
    } else {
      if (bullets.length > 0) { nodes.push(bl(bullets)); bullets = []; }
      nodes.push(p(trimmed));
    }
  }
  if (bullets.length > 0) nodes.push(bl(bullets));
  return nodes;
}

// Main export

export function generateIsoTemplate(config: TemplateConfig): TemplateResult {
  const { documentType, standards, orgContext, sections, title } = config;
  const docTitle = title || documentType;
  const org = orgContext || 'the organisation';

  const clauseSet = new Set<string>();
  for (const sec of sections) {
    const refs = SECTION_CLAUSES[sec];
    if (refs) refs.forEach((r) => clauseSet.add(r));
  }
  const clauseRefs = Array.from(clauseSet).sort((a, b) => parseFloat(a) - parseFloat(b));

  const sectionTexts = sections.map((sec) =>
    generateSectionText(sec, documentType, standards, org, docTitle),
  );

  const headerText =
    docTitle.toUpperCase() + '\n' +
    '='.repeat(docTitle.length) + '\n\n' +
    'Standards: ' + stdList(standards) + '\n' +
    'Document Type: ' + documentType + '\n' +
    'Status: DRAFT\n' +
    'Generated: ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) +
    '\n\n---\n';

  const bodyText = sections
    .map((sec, i) => `${i + 1}. ${sec}\n${'-'.repeat(40)}\n\n${sectionTexts[i]}`)
    .join('\n\n');

  const content = headerText + '\n' + bodyText;

  const tipTapContent: TipTapNode[] = [];
  tipTapContent.push(h(1, docTitle));
  tipTapContent.push({
    type: 'paragraph',
    content: [
      tn('Standards: ' + stdList(standards) + ' | Document Type: ' + documentType + ' | Status: DRAFT | Generated: ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })),
    ],
  });
  tipTapContent.push({ type: 'horizontalRule' });

  for (let i = 0; i < sections.length; i++) {
    tipTapContent.push(...sectionToNodes(sections[i], sectionTexts[i], i));
    if (i < sections.length - 1) tipTapContent.push({ type: 'paragraph' });
  }

  const bodyJsonb: Record<string, unknown> = { type: 'doc', content: tipTapContent };
  return { content, clauseRefs, bodyJsonb };
}
