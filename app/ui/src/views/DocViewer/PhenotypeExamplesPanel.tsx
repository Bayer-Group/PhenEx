import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import phenotypeExamplesRaw from '/assets/phenotype_examples.json?raw';
import { SECTIONS, parseClassName } from './PhenotypeReferencePanel';
import styles from './PhenotypeExamplesPanel.module.css';

const phenotypeExamples: Record<string, string[]> = JSON.parse(phenotypeExamplesRaw);

// Flat ordered list of class names derived from the reference panel sections
const ORDERED_CLASSES = SECTIONS.flatMap(section =>
  section.groups.flatMap(group => [
    group.root.class,
    ...(group.children?.map(c => c.class) ?? []),
  ])
).filter(cls => (phenotypeExamples[cls]?.length ?? 0) > 0);

interface PhenotypeExamplesPanelProps {
  onRegisterScroll: (fn: (className: string | null) => void) => void;
}

export const PhenotypeExamplesPanel: React.FC<PhenotypeExamplesPanelProps> = ({ onRegisterScroll }) => {
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
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
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Examples</h2>
        <p className={styles.panelSubtitle}>
          Hover or click "Examples" on a phenotype card to jump to that section.
        </p>
      </div>
      {ORDERED_CLASSES.map(cls => {
        const { title, tag } = parseClassName(cls);
        const examples = phenotypeExamples[cls];
        const dimmed = activeClass !== null && activeClass !== cls;
        return (
          <section
            key={cls}
            className={`${styles.phenotypeSection} ${dimmed ? styles.dimmed : ''}`}
            ref={el => { sectionRefs.current[cls] = el; }}
          >
            <div className={styles.phenotypeSectionHeader}>
              <h3 className={styles.phenotypeName}>{title}</h3>
              {tag && <span className={styles.phenotypeTag}>{tag}</span>}
            </div>
            <ul className={styles.exampleList}>
              {examples.map((ex, i) => (
                <li key={i} className={styles.exampleItem}>
                  <ReactMarkdown>{ex}</ReactMarkdown>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
};
