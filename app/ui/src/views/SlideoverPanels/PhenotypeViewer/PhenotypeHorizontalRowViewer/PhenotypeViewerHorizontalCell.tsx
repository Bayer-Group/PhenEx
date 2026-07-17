import { FC, useState } from 'react';
import typeStyles from '../../../../styles/study_types.module.css';
import styles from './PhenotypeViewerHorizontalCell.module.css';
import { Phenotype, PhenotypeDataService } from '../PhenotypeDataService';
import { PhenotypeViewer } from '../PhenotypeViewer';
import { PhenotypeComponents } from '../PhenotypeComponents/PhenotypeComponents';
import { SmartBreadcrumbs } from '../../../../components/SmartBreadcrumbs';
import { SmartTextField } from '../../../../components/SmartTextField';
import { DeleteConfirmModal } from '../../../../components/DeleteConfirmModal/DeleteConfirmModal';
import { TwoPanelCohortViewerService } from '../../../CohortViewer/TwoPanelCohortViewer/TwoPanelCohortViewer';
import { CohortViewType } from '../../../CohortViewer/CohortViewer';

interface PhenotypeViewerHorizontalCellProps {
  data: Phenotype;
  /** Whether this cell is the currently focused card (drives interactivity). */
  isFocused: boolean;
  /** Close the whole phenotype viewer. */
  onClose: () => void;
}

/**
 * A single full-screen phenotype card. Contains the phenotype breadcrumbs,
 * editable name/description, the parameter grid and its component phenotypes —
 * i.e. everything that used to live in the old `PhenotypePanel` popup.
 */
export const PhenotypeViewerHorizontalCell: FC<PhenotypeViewerHorizontalCellProps> = ({
  data,
  isFocused,
  onClose,
}) => {
  const dataService = PhenotypeDataService.getInstance();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const typeColor = typeStyles[`${data.effective_type}_text_color`];
  const backgroundColor = typeStyles[`${data.effective_type}_color_block_dim`];

  const onClickAncestor = (ancestor: Phenotype) => {
    TwoPanelCohortViewerService.getInstance().displayExtraContent(
      'phenotype' as CohortViewType,
      ancestor
    );
  };

  const renderBreadcrumbs = () => {
    const ancestors =
      data.type === 'component' ? dataService.cohortDataService.getAllAncestors(data) : [];
    const cohortName = dataService.getCohortName();
    const studyName = dataService.cohortDataService.getStudyNameForCohort();

    const breadcrumbItems = [
      {
        displayName: 'My Studies',
        onClick: () => {
          window.location.href = '/studies';
        },
      },
      ...(studyName
        ? [
            {
              displayName: studyName,
              onClick: () => {
                const studyId = dataService.cohortDataService.cohort_data?.study_id;
                if (studyId) window.location.href = `/studies/${studyId}`;
              },
            },
          ]
        : []),
      {
        displayName: cohortName || 'Unnamed Cohort',
        onClick: onClose,
      },
      ...ancestors.map(ancestor => ({
        displayName: ancestor.name || ancestor.id || 'Unnamed',
        onClick: () => onClickAncestor(ancestor as Phenotype),
      })),
      {
        displayName: data.name || 'Unnamed Phenotype',
        onClick: () => {},
      },
    ];

    return (
      <>
        <div className={`${styles.index} ${typeColor}`}>{data.hierarchical_index}</div>
        <SmartBreadcrumbs
          items={breadcrumbItems}
          onEditLastItem={newValue => dataService.valueChanged('name', newValue)}
          classNameSmartBreadcrumbsContainer={styles.breadcrumbsContainer}
          classNameBreadcrumbItem={`${styles.breadcrumbItem} ${typeColor}`}
          classNameBreadcrumbLastItem={`${styles.breadcrumbLastItem} ${typeColor}`}
          compact={false}
        />
      </>
    );
  };

  const handleConfirmDelete = () => {
    setShowDeleteModal(false);
    if (data.id) dataService.cohortDataService.deletePhenotype(data.id);
    onClose();
  };

  return (
    <div className={styles.cell} onClick={onClose}>
      <div className={`${styles.card}`} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTopRow}>
            {renderBreadcrumbs()}
            <button
              className={styles.deleteButton}
              onClick={() => setShowDeleteModal(true)}
              title="Delete this phenotype"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          </div>
          <div className={styles.descriptionContainer}>
            <SmartTextField
              value={data.description || ''}
              onSave={newValue => dataService.valueChanged('description', newValue)}
              placeholder="Add description..."
              className={`${styles.description} ${typeColor}`}
            />
          </div>
        </div>

        {/* Only the focused card wires up the editable grid + components; the
            neighbouring preview cards render lightweight placeholders. */}
        {isFocused && (
          <>
            <div className={styles.viewerSection}>
              <PhenotypeViewer data={data} />
            </div>
            <div className={styles.componentsSection}>
              <PhenotypeComponents data={data} />
            </div>
          </>
        )}
      </div>

      {showDeleteModal && (
        <DeleteConfirmModal
          name={data.name || ''}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
};
