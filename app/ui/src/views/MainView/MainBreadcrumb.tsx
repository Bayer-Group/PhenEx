import { FC, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MainBreadcrumb.module.css';
import { StudyDataService } from '../StudyViewer/StudyDataService';
import { CohortDataService } from '../CohortViewer/CohortDataService/CohortDataService';
import { HierarchicalLeftPanelDataService } from '../LeftPanel/HierarchicalLeftPanelDataService';
import { PhenExNavBarMenu } from '../../components/PhenExNavBar/PhenExNavBarMenu';

interface MainBreadcrumbProps {
  /** Study id used to build the study-level link. */
  studyId?: string;
  /** Whether the current view is a cohort (adds the cohort-name and section crumbs). */
  showCohort: boolean;
}

/** Cohort sections, each mapped to the CohortDataService phenotype filter it applies. */
const SECTIONS: { label: string; filter: string | string[] }[] = [
  { label: 'Definition', filter: ['entry', 'inclusion', 'exclusion'] },
  { label: 'Characteristics', filter: 'baseline' },
  { label: 'Outcomes', filter: 'outcome' },
];

/** A small auto-focusing inline text input used for renaming (mirrors OutlinePanel). */
const InlineEdit: FC<{ value: string; onCommit: (v: string) => void; onCancel: () => void }> = ({
  value,
  onCommit,
  onCancel,
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const commit = () => {
    const next = ref.current?.value.trim() ?? '';
    if (next && next !== value) onCommit(next);
    else onCancel();
  };
  return (
    <input
      ref={ref}
      className={styles.renameInput}
      defaultValue={value}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={commit}
    />
  );
};

/** Breadcrumb for the main view: {study name} / {cohort name} / {section}. */
export const MainBreadcrumb: FC<MainBreadcrumbProps> = ({ studyId, showCohort }) => {
  const navigate = useNavigate();
  const [studyName, setStudyName] = useState('');
  const [cohortName, setCohortName] = useState('');
  const [editing, setEditing] = useState<'study' | 'cohort' | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [isSectionMenuOpen, setSectionMenuOpen] = useState(false);
  const sectionButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const service = StudyDataService.getInstance();
    const update = () => setStudyName(service.study_name);
    update();
    service.addStudyDataServiceListener(update);
    return () => service.removeStudyDataServiceListener(update);
  }, []);

  useEffect(() => {
    if (!showCohort) {
      setCohortName('');
      return;
    }
    const service = CohortDataService.getInstance();
    const update = () => setCohortName(service.cohort_name);
    update();
    service.addListener(update);
    return () => service.removeListener(update);
  }, [showCohort]);

  const renameStudy = async (name: string) => {
    const service = StudyDataService.getInstance();
    service.study_name = name;
    await service.saveChangesToStudy(true, false);
    setStudyName(name);
    setEditing(null);
  };

  const renameCohort = async (name: string) => {
    const service = CohortDataService.getInstance();
    service.cohort_name = name;
    service.cohort_data.name = name;
    await service.saveChangesToCohort(true, false);
    setCohortName(name);
    const cohortId = service.cohort_data?.id;
    if (cohortId) HierarchicalLeftPanelDataService.getInstance().syncCohortDisplayName(cohortId, name);
    setEditing(null);
  };

  const selectSection = (index: number) => {
    setSectionIndex(index);
    CohortDataService.getInstance().filterType(SECTIONS[index].filter);
    setSectionMenuOpen(false);
  };

  return (
    <div className={styles.container} onClick={(e) => e.stopPropagation()}>
      {studyName &&
        (editing === 'study' ? (
          <InlineEdit value={studyName} onCommit={renameStudy} onCancel={() => setEditing(null)} />
        ) : (
          <button
            className={`${styles.crumb} ${styles.crumb_study}`}
            onClick={() => studyId && navigate(`/studies/${studyId}`)}
            onDoubleClick={() => setEditing('study')}
          >
            {studyName}
          </button>
        ))}

      {showCohort && cohortName && (
        <>
          <span className={styles.separator}>/</span>
          {editing === 'cohort' ? (
            <InlineEdit value={cohortName} onCommit={renameCohort} onCancel={() => setEditing(null)} />
          ) : (
            <span
              className={`${styles.crumb} ${styles.crumb_cohort}`}
              onDoubleClick={() => setEditing('cohort')}
            >
              {cohortName}
            </span>
          )}
        </>
      )}

      {showCohort && (
        <>
          <span className={styles.separator}>/</span>
          <button
            ref={sectionButtonRef}
            className={`${styles.crumb} ${styles.crumb_section}`}
            onClick={() => setSectionMenuOpen((open) => !open)}
          >
            {SECTIONS[sectionIndex].label}
          </button>
          <PhenExNavBarMenu
            isOpen={isSectionMenuOpen}
            onClose={() => setSectionMenuOpen(false)}
            anchorElement={sectionButtonRef.current}
            verticalPosition="below"
            horizontalAlignment="left"
            gap={4}
          >
            <div className={styles.sectionMenu}>
              {SECTIONS.map((section, index) => (
                <button
                  key={section.label}
                  className={styles.sectionMenuItem}
                  onClick={() => selectSection(index)}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </PhenExNavBarMenu>
        </>
      )}
    </div>
  );
};
