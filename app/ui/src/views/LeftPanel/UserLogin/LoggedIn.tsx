import { FC, useRef} from 'react';
import styles from './UserLogin.module.css';
import { CustomizableDropdownButton } from '../../../components/ButtonsBar/CustomizableDropdownButton';

interface LoggedInProps {
}

export const LoggedIn: FC<LoggedInProps> = ({}) => {
  const customizableDropdownButtonRef = useRef(null);

  const renderUserPanel = () => {
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
    <CustomizableDropdownButton
            key={"login"}
            label={"@ahartens"}
            content={renderLogin()}
            ref={customizableDropdownButtonRef}
    />
  );
};
