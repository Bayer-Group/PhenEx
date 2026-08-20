import React, { useMemo } from 'react';
import classDefinitionsRaw from '/assets/class_definitions.json?raw';
import parametersInfoRaw from '/assets/parameters_info.json?raw';
import ReactMarkdown from 'react-markdown';
import styles from './DocViewer.module.css';

const classDefinitions: Record<string, any[]> = JSON.parse(classDefinitionsRaw);
const parametersInfo: Record<string, any> = JSON.parse(parametersInfoRaw);

const PHENOTYPE_ORDER = [
  'CodelistPhenotype',
  'MeasurementPhenotype',
  'CategoricalPhenotype',
  'TimeRangePhenotype',
  'AgePhenotype',
  'DeathPhenotype',
  'LogicPhenotype',
  'ScorePhenotype',
  'ArithmeticPhenotype',
  'EventCountPhenotype',
  'BinPhenotype',
  'MeasurementChangePhenotype',
  'UserDefinedPhenotype',
];

const orderedClasses = [
  ...PHENOTYPE_ORDER.filter(n => classDefinitions[n]),
  ...Object.keys(classDefinitions).filter(n => !PHENOTYPE_ORDER.includes(n)),
];

function formatClassName(name: string): string {
  return name.replace('Phenotype', '');
}

function formatParamName(param: string): string {
  return param.split('_').join(' ');
}

interface ParamRowProps {
  param: any;
}

const ParamRow: React.FC<ParamRowProps> = ({ param }) => {
  const info = parametersInfo[param.param];
  const description = info?.description ?? '';

  return (
    <div className={styles.paramRow}>
      <div className={styles.paramLeft}>
        <span className={`${styles.paramName} ${param.required ? styles.required : ''}`}>
          {formatParamName(param.display_name ?? param.param)}
        </span>
        <span className={styles.paramType}>{param.type}</span>
        {param.default !== null && param.default !== undefined && (
          <span className={styles.paramDefault}>default: {String(param.default)}</span>
        )}
      </div>
      {description && (
        <div className={styles.paramDescription}>
          <ReactMarkdown>{description}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

interface PhenotypeCardProps {
  className: string;
  params: any[];
}

const PhenotypeCard: React.FC<PhenotypeCardProps> = ({ className, params }) => {
  const visibleParams = useMemo(() => params.filter(p => p.user_visible), [params]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{formatClassName(className)}</h2>
        <span className={styles.cardClassName}>{className}</span>
      </div>
      <div className={styles.paramList}>
        {visibleParams.length === 0 ? (
          <div className={styles.noParams}>No parameters</div>
        ) : (
          visibleParams.map(param => <ParamRow key={param.param} param={param} />)
        )}
      </div>
    </div>
  );
};

export const DocViewer: React.FC = () => {
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Phenotype Reference</h1>
        <p className={styles.pageSubtitle}>All available phenotype classes and their parameters</p>
      </div>
      <div className={styles.cardGrid}>
        {orderedClasses.map(className => (
          <PhenotypeCard key={className} className={className} params={classDefinitions[className]} />
        ))}
      </div>
    </div>
  );
};
