import React, { useEffect, useRef, useState } from 'react';
import { SimpleCustomScrollbar } from '../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import ReactMarkdown from 'react-markdown';
import { SECTIONS, parseClassName } from './PhenotypeReferencePanel';
import styles from './PhenotypeExamplesPanel.module.css';

interface ExampleSubsection {
  subsection: string;
  examples: string[];
}

type PhenotypeExampleValue = string[] | ExampleSubsection[];

function isSubsections(value: PhenotypeExampleValue): value is ExampleSubsection[] {
  return value.length > 0 && typeof value[0] === 'object';
}

const phenotypeExamples: Record<string, PhenotypeExampleValue> = {
  EventPhenotype: [
    'Identify all events in the inpatient hospitalization setting prior to index.',
    'Identify all drug dispensations in the post index period',
  ],
  CodelistPhenotype: [
    {
      subsection: 'Filter patients by codelist, or fuzzy match for codes beginning with',
      examples: [
        'Identify patients with **type 2 diabetes** diagnoses using ICD-10-CM and ICD-9-CM codes from the codelist named `Type 2 Diabetes` on the Diagnosis table.',
        'Identify patients with **metformin** drug exposure using NDC or RxNorm drug codes on the Dispensation table',
        'Identify patients with a **dialysis** procedure using CPT codes on the Procedure table',
        'Identify the patients medical codes starting with `E11.*` in the diagnosis table.',
      ],
    },
    {
      subsection: 'Perform additional categorical value filtering, using logical operators AND, OR, NOT',
      examples: [
        'Identify the atrial fibrillation diagnoses **in the inpatient setting**',
        'Identify the atrial fibrillation diagnoses **either in the inpatient setting, or the outpatient setting and in the primary diagnosis position**',
        'Identify the **KRAS** gene mutation with either a **positive** or **negative** result, but not **unknown**',
      ],
    },
    {
      subsection: 'Return **all events** that match, or the **first event**, the **last event**, or all events',
      examples: [
        'Identify the first occurrence of a **stroke diagnosis** using ICD codes (incident stroke)',
        'Identify the **earliest recorded metformin prescription** per patient.',
      ],
    },
    {
      subsection: 'Identify events within absolute time periods',
      examples: [
        'Identify all **anemia diagnoses** between **January 1, 2020 and December 31, 2020**',
        'Identify all **metformin prescriptions** between **January 1, 2020 and December 31, 2020**',],
    },
    {
      subsection: 'Identify events in temporal relation to one another',
      examples: [
        'Identify all heart valve procedures that occur **within 30 days after a heart failure diagnosis**',
        'Identify all patients who have a PCOS diagnosis in the one year prior to **birth control drug exposure**',
      ],
    },
  ],
  MeasurementPhenotype: [
    {
      subsection: 'Get measurements by codelist',
      examples: [
        'Get all **HbA1c** values using LOINC codes from the `HbA1c` codelist on the Measurement table.',
        'Get all **systolic blood pressure** readings using LOINC codes.',
        'Get all **eGFR** results using a codelist containing relevant LOINC codes.',
      ],
    },
    {
      subsection: 'Filter by numerical value',
      examples: [
        'Identify patients with **HbA1c > 7.5%**.',
        'Identify patients with **systolic blood pressure ≥ 140 mmHg**.',
        'Filter to **eGFR between 15 and 60** to identify moderate-to-severe CKD.',
      ],
    },
    {
      subsection: 'Aggregate multiple values per patient',
      examples: [
        'Use `Last()` to capture the **most recent eGFR** before index.',
        'Use `Mean()` to average all **HbA1c readings** within the 12-month baseline period.',
        'Use `Max()` to capture the **peak troponin level** during a hospitalization.',
      ],
    },
    {
      subsection: 'Restrict to a time window or absolute date range',
      examples: [
        'Get the last **systolic blood pressure** in the 6 months prior to index.',
        'Get all **HbA1c values** between January 1, 2018 and December 31, 2020.',
      ],
    },
  ],
  CategoricalPhenotype: [
    'Identify patients recorded as **female sex** in the PERSON domain.',
    'Identify patients with an **inpatient** hospitalization visit type.',
  ],
  AgePhenotype: [
    'Identify patients aged **18–65** at index date.',
    'Identify patients who were **≥ 65 years old** at the time of their first diagnosis.',
  ],
  DeathPhenotype: [
    'Identify patients who **died within 30 days** of a hospitalization.',
    'Exclude patients who **died before the study start date**.',
  ],
  LogicPhenotype: [
    {
      subsection: 'Combine criteria with AND',
      examples: [
        'Identify patients with **type 2 diabetes AND at least one HbA1c measurement** by combining a `CodelistPhenotype` AND a `MeasurementPhenotype`.',
        'Require a **stroke diagnosis AND an anticoagulant prescription** within 30 days of each other.',
      ],
    },
    {
      subsection: 'Combine criteria with OR',
      examples: [
        'Identify patients with **hypertension OR a recorded antihypertensive prescription**.',
        'Identify patients with **type 1 OR type 2 diabetes** using two separate codelists.',
      ],
    },
    {
      subsection: 'Exclude patients using NOT',
      examples: [
        'Exclude patients with a **prior cancer diagnosis** by applying NOT to a cancer `CodelistPhenotype`.',
        'Exclude patients who have **prior metformin exposure** before the index date.',
      ],
    },
  ],
  ArithmeticPhenotype: [
    'Calculate **BMI** by dividing a weight `MeasurementPhenotype` by the square of a height `MeasurementPhenotype`.',
    'Calculate **eGFR** from serum creatinine, age, and sex measurements.',
  ],
  ScorePhenotype: [
    'Compute the **CHA₂DS₂-VASc** score by summing points for congestive heart failure, hypertension, age, diabetes, stroke history, vascular disease, and sex.',
    'Compute the **Charlson Comorbidity Index** from a set of diagnosis-based phenotypes.',
  ],
  BinPhenotype: [
    'Bin a **BMI measurement** into categories: underweight (<18.5), normal (18.5–25), overweight (25–30), obese (≥30).',
    'Bin **HbA1c** into controlled (<7%), borderline (7–9%), and uncontrolled (>9%) categories.',
  ],
  EventCountPhenotype: [
    {
      subsection: 'Count events from a child phenotype',
      examples: [
        'Count the number of **outpatient diabetes diagnosis visits** per patient in the 12 months before index.',
        'Count the number of **distinct HbA1c measurement days** in the baseline period.',
        'Count the number of **metformin dispensations** within 6 months of a diabetes diagnosis.',
      ],
    },
    {
      subsection: 'Filter patients by event count',
      examples: [
        'Require **≥ 2 outpatient visits** with a diabetes diagnosis within 12 months (prevalent case definition).',
        'Require at least **3 distinct blood pressure readings** during the baseline period.',
      ],
    },
  ],
  MeasurementChangePhenotype: [
    {
      subsection: 'Detect a decrease in a measurement',
      examples: [
        'Identify patients with a **haemoglobin drop of ≥ 2 g/dL** within any 7-day window.',
        'Detect an **LDL reduction of ≥ 30 mg/dL** between two measurements taken within 90 days.',
        'Detect an **eGFR decline of ≥ 15 mL/min** between measurements at least 30 days apart.',
      ],
    },
    {
      subsection: 'Detect an increase in a measurement',
      examples: [
        'Detect a **troponin rise of ≥ 0.5 ng/mL** between two measurements within 24 hours.',
        'Detect a **creatinine increase of ≥ 0.3 mg/dL** within any 48-hour window.',
      ],
    },
  ],
  WithinSameEncounterPhenotype: [
    'Identify patients with a **sepsis diagnosis and a blood culture order on the same visit**.',
    'Require that a **troponin elevation and chest pain diagnosis** both occur within the same encounter.',
  ],
  TimeRangePhenotype: [
    'Identify patients with **≥ 365 days of continuous insurance coverage** before index.',
    'Define an **observation window** of at least 180 days for baseline covariate capture.',
  ],
  TimeRangeCountPhenotype: [
    'Count the **number of distinct continuous enrollment periods** a patient has.',
    'Require that a patient has **≥ 2 separate insurance periods** of at least 90 days each.',
  ],
  TimeRangeDayCountPhenotype: [
    'Count the **total days of insurance coverage** a patient has within the study period.',
    'Require **≥ 180 cumulative days** of coverage in the 12 months prior to index.',
  ],
  TimeRangeDaysToNextRange: [
    'Calculate the **gap in days between consecutive insurance periods** to identify coverage lapses.',
    'Flag patients with a **coverage gap of more than 30 days** between two enrollment periods.',
  ],
  FurtherValueFilterPhenotype: [
    'Apply a **physiologically plausible range filter** (e.g., heart rate between 20 and 300 bpm) on top of an existing measurement phenotype.',
    'Filter a **weight measurement** to exclude implausible values below 10 kg or above 300 kg.',
  ],
  UserDefinedPhenotype: [
    'Use a custom Python function to implement a **complex washout period logic** not expressible with standard phenotypes.',
    'Implement a **site-specific algorithm** for defining index dates using proprietary data fields.',
  ],
};

// Flat ordered list of class names derived from the reference panel sections
const ORDERED_CLASSES = SECTIONS.flatMap(section =>
  section.groups.flatMap(group => [
    group.root.class,
    ...(group.children?.map(c => c.class) ?? []),
  ])
).filter(cls => (phenotypeExamples[cls]?.length ?? 0) > 0);

interface PhenotypeExamplesPanelProps {
  onRegisterScroll: (fn: (className: string | null) => void) => void;
  onSectionClick?: (className: string) => void;
  onSectionLeave?: () => void;
}

export const PhenotypeExamplesPanel: React.FC<PhenotypeExamplesPanelProps> = ({ onRegisterScroll, onSectionClick, onSectionLeave }) => {
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeClass, setActiveClass] = useState<string | null>(null);

  useEffect(() => {
    onRegisterScroll((className) => {
      if (className === null) {
        setActiveClass(null);
      } else {
        setActiveClass(className);
        sectionRefs.current[className]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }, [onRegisterScroll]);

  return (
    <div className={styles.panelWrapper}>
      <div className={styles.stickyHeader}>
        <h2 className={styles.stickyTitle}>Examples</h2>
      </div>
      <div className={styles.scrollArea}>
      <div ref={scrollRef} className={styles.panel}>
      {ORDERED_CLASSES.map(cls => {
        const { title, tag } = parseClassName(cls);
        const examples = phenotypeExamples[cls];
        const dimmed = activeClass !== null && activeClass !== cls;
        return (
          <section
            key={cls}
            className={`${styles.phenotypeSection} ${dimmed ? styles.dimmed : ''}`}
            ref={el => { sectionRefs.current[cls] = el; }}
            onClick={() => { setActiveClass(cls); onSectionClick?.(cls); }}
            onMouseLeave={() => { setActiveClass(null); onSectionLeave?.(); }}
            style={onSectionClick ? { cursor: 'pointer' } : undefined}
          >
            <div className={styles.phenotypeSectionHeader}>
              <h3 className={styles.phenotypeName}>{title}</h3>
              {tag && <span className={styles.phenotypeTag}>{tag}</span>}
            </div>
            {isSubsections(examples) ? (
              examples.map((sub, si) => (
                <div key={si} className={styles.subsection}>
                  <h4 className={styles.subsectionTitle}>{sub.subsection}</h4>
                  <ul className={styles.exampleList}>
                    {sub.examples.map((ex, i) => (
                      <li key={i} className={styles.exampleItem}>
                        <ReactMarkdown>{ex}</ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <ul className={styles.exampleList}>
                {(examples as string[]).map((ex, i) => (
                  <li key={i} className={styles.exampleItem}>
                    <ReactMarkdown>{ex}</ReactMarkdown>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      </div>
      <div className={styles.headerGradient} />
      <div className={styles.scrollbarRegion}>
        <SimpleCustomScrollbar
          targetRef={scrollRef}
          orientation="vertical"
          marginTop={10}
          marginBottom={10}
          marginToEnd={0}
          classNameTrack={styles.scrollBarTrack}
          classNameThumb={styles.scrollBarThumb}
          showOnHover={true}
        />
      </div>
      </div>
    </div>
  );
};
