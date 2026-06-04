import { TwoPanelCohortViewerService } from '../../TwoPanelCohortViewer/TwoPanelCohortViewer';
import { CohortViewType } from '../../CohortViewer';
import { SingleLogicalExpression } from '../CellEditors/logicalExpressionEditor/types';

/**
 * Cell Renderer Handler Utilities
 * 
 * These handlers can be imported and passed to PhenexCellRenderer to avoid
 * the lazy loading delay that occurs when using the default handlers.
 * 
 * Usage in any cell renderer:
 * ```tsx
 * import { createEditHandler, createDeleteHandler } from './cellRendererHandlers';
 * 
 * const MyCellRenderer = (props) => {
 *   const handleEdit = createEditHandler(props);
 *   const handleDelete = createDeleteHandler(props);
 *   
 *   return (
 *     <PhenexCellRenderer 
 *       {...props} 
 *       showButtons={true}
 *       onEdit={handleEdit}
 *       onDelete={handleDelete}
 *     >
 *       {content}
 *     </PhenexCellRenderer>
 *   );
 * };
 * ```
 */

/**
 * Default edit handler for cell renderers
 * Opens the phenotype detail panel in the two-panel viewer
 */
export const createEditHandler = (props: any) => () => {
  const cohortViewer = TwoPanelCohortViewerService.getInstance();
  cohortViewer.displayExtraContent('phenotype' as CohortViewType, props.data);
};

/**
 * Default delete handler for cell renderers
 * Opens the settings cell editor (more options menu)
 */
export const createDeleteHandler = (props: any) => () => {
  if (!props.node || !props.column || props.node.rowIndex === null) return;
  
  const params = {
    rowIndex: props.node.rowIndex,
    colKey: props.column.getColId(),
    key: 'settings',
  };
  props.api?.startEditingCell(params);
};

/**
 * Handler for editing a specific logical expression item
 * Opens the phenotype detail panel for the clicked expression
 */
export const createLogicalExpressionEditHandler = () => async (expression: SingleLogicalExpression, event: React.MouseEvent) => {
  // Dynamic import to avoid circular dependency
  const { CohortDataService } = await import('../../CohortDataService/CohortDataService');
  const cohortDataService = CohortDataService.getInstance();
  const phenotype = cohortDataService.getPhenotypeById(expression.phenotype_id);
  
  if (phenotype) {
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('phenotype' as CohortViewType, phenotype);
  }
};
