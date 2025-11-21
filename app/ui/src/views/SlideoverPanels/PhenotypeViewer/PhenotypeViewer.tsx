import React, { useEffect, useRef, useState } from 'react';
import styles from './PhenotypeViewer.module.css';
import { AgGridReact } from '@ag-grid-community/react';
import { PhenotypeDataService, Phenotype } from './PhenotypeDataService';
import { AgGridWithCustomScrollbars } from '../../../components/AgGridWithCustomScrollbars/AgGridWithCustomScrollbars';
import typeStyles from '../../../styles/study_types.module.css';
interface PhenotypeViewerProps {
  data?: Phenotype;
  bottomMargin?: number;
}

export const PhenotypeViewer: React.FC<PhenotypeViewerProps> = ({ data, bottomMargin = 0 }) => {
  const dataService = useRef(PhenotypeDataService.getInstance()).current;
  const gridRef = useRef<any>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [typeColor, setTypeColor] = useState('red');

  const refreshGrid = () => {
    const maxRetries = 5;
    const retryDelay = 100; // milliseconds
    let retryCount = 0;

    const tryRefresh = () => {
      if (gridRef.current?.api) {
        const api = gridRef.current.api;

        api.setGridOption('rowData', dataService.rowData);

        // Force scroll to top after refresh
        requestAnimationFrame(() => {
          api.ensureIndexVisible(0, 'top');
          
          // Also scroll the viewport directly
          if (gridContainerRef.current) {
            const agGridViewport = gridContainerRef.current.querySelector('.ag-body-viewport');
            if (agGridViewport) {
              agGridViewport.scrollTop = 0;
            }
          }
        });
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(tryRefresh, retryDelay);
      }
    };
    // refresh ag-grid when new data is available.
    // if ag-grid is not ready, retry after a delay.
    tryRefresh();
  };

  useEffect(() => {
    const listener = (refreshPhenotypeGrid: boolean = false) => {
      console.log("this is the REFRESHING", refreshPhenotypeGrid)
      if (refreshPhenotypeGrid) {
        console.log("AM REFRESHING GRID!!")
        refreshGrid();
      }
    };
    dataService.addListener(listener);

    if (data) {
      console.log('SETTING DATA', data);
      dataService.setData(data);
      
      // Multiple attempts to scroll to top when new data is loaded
      const scrollToTop = () => {
        if (gridRef.current?.api) {
          gridRef.current.api.ensureIndexVisible(0, 'top');
        }
        
        // Also scroll the AG Grid viewport directly
        if (gridContainerRef.current) {
          const agGridViewport = gridContainerRef.current.querySelector('.ag-body-viewport');
          if (agGridViewport) {
            agGridViewport.scrollTop = 0;
          }
        }
      };
      
      // Try multiple times with increasing delays to handle dynamic row heights
      setTimeout(scrollToTop, 50);
      setTimeout(scrollToTop, 200);
      setTimeout(scrollToTop, 500);
    }

    // Set type color based on phenotype type
    if (data?.effective_type && typeStyles[`${data.effective_type}_color_block`]) {
      setTypeColor(typeStyles[`${data.effective_type}_color_block`]);
    } else {
      setTypeColor('red'); // default color
    }

    return () => {
      dataService.removeListener(listener);
    };
  }, [data]);

  const onCellValueChanged = async (event: any) => {
    console.log("PHENOTYPE VIEWER: ON CELL VALUE CHANGED");
    if (event.newValue !== event.oldValue) {
      console.log("PHENOTYPE VIEWER: VALUE CHANGED");
      dataService.valueChanged(event.data, event.newValue);
    }
  };

  const renderPhenotypeEditorTable = () => {
    return (
      <div className={styles.gridContainer} style={{ marginBottom: `${bottomMargin}px` }}>
        <AgGridWithCustomScrollbars
          rowData={dataService.rowData}
          columnDefs={dataService.getColumnDefs()}
          ref={gridRef}
          theme={dataService.getTheme()}
          onCellValueChanged={onCellValueChanged}
          scrollbarConfig={{ vertical: { classNameThumb: typeColor, marginToEnd: -15 }, horizontal: { enabled: false } }}
          animateRows={false}
          
          getRowHeight={params => {
            // Calculate height of CODELISTS
            let current_max_height = 100;

            if (params.data?.parameter == 'codelist' && params.data.codelist?.codelist) {
              const numEntries = Object.keys(params.data.codelist.codelist).length;
              const codelist_phenotype_height = Math.max(48, numEntries * 50 + 20); // Adjust row height based on number of codelist entries
              current_max_height = Math.max(current_max_height, codelist_phenotype_height);
              return current_max_height;
            }

            if (params.data?.parameter == 'categorical_filter') {
              return current_max_height * 2;
            }

            // Calculate height of RELATIVE TIME RANGES
            if (
              params.data?.parameter == 'relative_time_range' &&
              params.data?.relative_time_range
            ) {
              if (
                params.data?.relative_time_range &&
                Array.isArray(params.data.relative_time_range)
              ) {
                const numEntries = params.data.relative_time_range.length;
                const time_range_phenotype_height = Math.max(48, numEntries * 30 + 20); // Adjust row height based on number of entries
                current_max_height = Math.max(current_max_height, time_range_phenotype_height);
              }
            }

            if (params.data?.parameter == 'description') {
              if (!params.data?.value) {
                current_max_height = 100;
                return current_max_height;
              }

              const descriptionCol = params.api.getColumnDef('description');
              // if (!descriptionCol || !params.data?.description) return 48; // Increased minimum height
              const descWidth = 200;
              const charPerLine = Math.floor(descWidth / 8);
              const lines = Math.ceil(params.data?.value.length / charPerLine);
              return Math.max(current_max_height, lines * 14 + 20); // Increased minimum height
            }

            return current_max_height;
          }}
        />
      </div>
    );
  };


  if (!data) {
    return (
      <div className={styles.container}>
        <h2>Select a phenotype to view details</h2>
      </div>
    );
  }

  return renderPhenotypeEditorTable();
};
