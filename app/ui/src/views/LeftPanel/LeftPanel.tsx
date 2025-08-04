import { FC, useRef} from 'react';
import styles from './LeftPanel.module.css';
import { CustomizableDropdownButton } from '../../components/ButtonsBar/CustomizableDropdownButton';

interface LeftPanelProps {
  isVisible: boolean;
  width: number;
  children?: React.ReactNode;
  onPathClick?: (event: React.MouseEvent) => void;
  selectedPath?: string;
}

export const LeftPanel: FC<LeftPanelProps> = ({ isVisible, width, children, onPathClick }) => {
  const customizableDropdownButtonRef = useRef(null);

  const renderLogin = () => {
    return (
      <div className={styles.phenotypeSelection}>
        <div className={styles.loginHeader} onClick={() => clickedOnHeader()}>
          @ahartens
          <span className={styles.loginHeaderButton}>Close</span>
        </div>
        {/* <TypeSelectorEditor onValueChange={handlePhenotypeSelection} /> */}
      </div>
    );
  };

  const clickedOnHeader = () => {
    console.log('CLICKED ON HEDAER', customizableDropdownButtonRef);
    customizableDropdownButtonRef.current?.closeDropdown();
  };


  return (
    <div
      className={`${styles.leftPanel} ${isVisible ? styles.visible : styles.hidden}`}
      style={{ width: `${width}px` }}
    >
      <div className = {styles.controls}>
        <CustomizableDropdownButton
                key={"login"}
                label={"@ahartens"}
                content={renderLogin()}
                ref={customizableDropdownButtonRef}
        />
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};
