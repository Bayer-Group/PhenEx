import React from 'react';
import styles from './DomainSelectorEditor.module.css';

export interface DomainSelectorEditorProps {
  value?: any;
  onValueChange?: (value: any) => void;
}

const domains = [
  {name:'ConditionDomain', info:"For medical conditions, diagnoses, and health problems recorded in clinical settings."},
  {name:'DrugDomain', info:"For medication prescriptions, drug exposures, and pharmaceutical treatments."},
  {name:'ProcedureDomain', info:"For medical procedures, surgeries, and interventions performed on patients."},
  {name:'ObservationDomain', info:"For clinical observations, vital signs, and general patient measurements."},
  {name:'MeasurementDomain', info:"For laboratory tests, diagnostic measurements, and quantitative clinical results."},
  {name:'VisitDomain', info:"For healthcare encounters, hospital visits, and clinical appointments."},
  {name:'DeviceDomain', info:"For medical devices, implants, and equipment used in patient care."},
  {name:'DeathDomain', info:"For mortality data, death records, and related information."},
  {name:'NoteDomain', info:"For clinical notes, medical documentation, and textual healthcare records."}
];

export const DomainSelectorEditor: React.FC<DomainSelectorEditorProps> = (props) => {
  const [selectedDomain, setSelectedDomain] = React.useState<string | null>(props.value || null);

  const handleDomainSelect = (domainName: string) => {
    setSelectedDomain(domainName);
    props.onValueChange?.(domainName);
  };

  return (
    <div className={styles.container}>
      {domains.map((domain) => (
        <div
          key={domain.name}
          className={`${styles.domainSection} ${selectedDomain === domain.name ? styles.selected : ''}`}
          onClick={() => handleDomainSelect(domain.name)}
        >
          <div className={styles.domainName}>{domain.name.replace('Domain', '')}</div>
          <p className={styles.domainInfo}>{domain.info}</p>
        </div>
      ))}
    </div>
  );
};