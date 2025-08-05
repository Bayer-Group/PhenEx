import { FC, useRef} from 'react';
import styles from './UserLogin.module.css';
import { CustomizableDropdownButton } from '../../../components/ButtonsBar/CustomizableDropdownButton';
import { ItemList } from '../../../components/ItemList/ItemList';
import { LoginDataService } from './LoginDataService';

interface LoggedInProps {
}

export const LoggedIn: FC<LoggedInProps> = ({}) => {
  const customizableDropdownButtonRef = useRef(null);

const items = [
  {
    name: 'Log Out',
    info: 'Log out of your PhenEx account',
  },

];


  const renderUserPanel = () => {
    return (
      <div className={styles.container}>
        <div className={styles.loginHeader} onClick={() => clickedOnHeader()}>
          @ahartens
          <span className={styles.loginHeaderButton}>Close</span>
        </div>
        <ItemList
            items={items}
            selectedName={undefined}
            onSelect={handleItemSelect}
        />
      </div>
    );
  };

  const clickedOnHeader = () => {
    console.log('CLICKED ON HEDAER', customizableDropdownButtonRef);
    customizableDropdownButtonRef.current?.closeDropdown();
  };
  const handleItemSelect = async (itemName: string) => {
    if (itemName === 'Log Out') {
      const loginService = LoginDataService.getInstance();
      await loginService.logout();
      // Force a reload to reset the app state
      window.location.reload();
    }
  };


  return (
    <CustomizableDropdownButton
            key={"login"}
            label={"@ahartens"}
            content={renderUserPanel()}
            ref={customizableDropdownButtonRef}
            menuClassName={styles.userDropdownMenu}
    />
  );
};
