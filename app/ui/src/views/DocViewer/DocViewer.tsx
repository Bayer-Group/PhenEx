import React, { useRef, useCallback } from 'react';
import { Layout, Model, IJsonModel } from 'flexlayout-react';
import 'flexlayout-react/style/light.css';
import { PhenotypeReferencePanel } from './PhenotypeReferencePanel';
import { PhenotypeExamplesPanel } from './PhenotypeExamplesPanel';
import styles from './DocViewer.module.css';

function createModel(): Model {
  const json: IJsonModel = {
    global: {
      tabEnableClose: false,
      tabEnableRename: false,
      tabEnableDrag: false,
      tabSetEnableMaximize: false,
      tabSetEnableDrop: false,
      borderEnableDrop: false,
    },
    borders: [],
    layout: {
      type: 'row',
      children: [
        {
          type: 'tabset',
          weight: 60,
          enableTabStrip: false,
          enableDrop: false,
          children: [{ type: 'tab', name: 'Reference', component: 'reference', enableClose: false, enableDrag: false }],
        },
        {
          type: 'tabset',
          weight: 40,
          enableTabStrip: false,
          enableDrop: false,
          children: [{ type: 'tab', name: 'Examples', component: 'examples', enableClose: false, enableDrag: false }],
        },
      ],
    },
  };
  return Model.fromJson(json);
}

export const DocViewer: React.FC = () => {
  const modelRef = useRef(createModel());
  const scrollToPhenotypeRef = useRef<(className: string | null) => void>(() => {});
  const scrollToCardRef = useRef<(className: string | null) => void>(() => {});

  const factory = useCallback((node: { getComponent: () => string | undefined }) => {
    switch (node.getComponent()) {
      case 'reference':
        return (
          <PhenotypeReferencePanel
            onExamplesActivate={(className) => scrollToPhenotypeRef.current(className)}
            onRegisterScroll={(fn) => { scrollToCardRef.current = fn; }}
          />
        );
      case 'examples':
        return (
          <PhenotypeExamplesPanel
            onRegisterScroll={(fn) => { scrollToPhenotypeRef.current = fn; }}
            onSectionClick={(className) => scrollToCardRef.current(className)}
            onSectionLeave={() => scrollToCardRef.current(null)}
          />
        );
      default:
        return null;
    }
  }, []);

  return (
    <div className={styles.docViewerLayout}>
      <Layout model={modelRef.current} factory={factory} />
    </div>
  );
};
