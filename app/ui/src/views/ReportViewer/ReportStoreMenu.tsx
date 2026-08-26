import { FC, useRef, useState } from 'react';
import { RightClickMenu } from '@/components/RightClickMenu/RightClickMenu';
import { exportSectionLayouts, importSectionLayouts } from './SectionLayouts/sectionLayoutStore';
import { exportFigureLegendSets, importFigureLegendSets } from './LeftPanels/FigureLegend/figureLegendSetStore';
import type { OutlineModel } from './LeftPanels/OutlinePanel/outlineModel';
import styles from './ReportStoreMenu.module.css';

/** Serialized bundle of every locally stored piece of report presentation state. */
interface StoreBundle {
  version: 1;
  /** Grid layouts (`phenex.sectionLayouts.v1`). */
  sectionLayouts: ReturnType<typeof exportSectionLayouts>;
  /** Figure legend sets (`phenex.figureLegendSets.v1`). */
  figureLegendSets: ReturnType<typeof exportFigureLegendSets>;
  /** Renamed sections/phenotypes and drag-reordered outline. */
  outline: OutlineModel | null;
}

interface ReportStoreMenuProps {
  /** Current outline edits (renamed sections/items, moves). */
  outline: OutlineModel | null;
  /** Replace the outline edits with an imported model. */
  onImportOutline: (outline: OutlineModel | null) => void;
}

/**
 * An ellipsis menu pinned to the right of the title bar that exports all
 * locally stored report presentation state to a single JSON file, and imports
 * it back — replacing the current state.
 */
export const ReportStoreMenu: FC<ReportStoreMenuProps> = ({ outline, onImportOutline }) => {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const bundle: StoreBundle = {
      version: 1,
      sectionLayouts: exportSectionLayouts(),
      figureLegendSets: exportFigureLegendSets(),
      outline,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'phenex-report-store.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      const bundle = JSON.parse(await file.text()) as Partial<StoreBundle>;
      importSectionLayouts(bundle.sectionLayouts ?? {});
      importFigureLegendSets(bundle.figureLegendSets ?? {});
      onImportOutline(bundle.outline ?? null);
    } catch {
      window.alert('Could not import store: the file is not a valid export.');
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.button}
        title="Report store"
        aria-label="Report store options"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMenuPos({ x: rect.right, y: rect.bottom });
        }}
      >
        ⋯
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
          e.target.value = '';
        }}
      />

      {menuPos && (
        <RightClickMenu
          position={menuPos}
          onClose={() => setMenuPos(null)}
          items={[
            {
              label: 'Export store',
              onClick: () => { handleExport(); setMenuPos(null); },
            },
            {
              label: 'Import store',
              onClick: () => { fileInputRef.current?.click(); setMenuPos(null); },
            },
          ]}
        />
      )}
    </>
  );
};
