import { FC, useRef } from 'react';
import styles from './UserLogin.module.css';
import { CustomizableDropdownButton } from '../../../components/ButtonsAndTabs/ButtonsBar/CustomizableDropdownButton';
import { ItemList } from '../../../components/ItemList/ItemList';
import { LoginDataService } from '../../../services/supabaseAuthService';
import { PopoverHeader } from '../../../components/PopoverHeader/PopoverHeader';

interface LoggedInProps {}

export const LoggedIn: FC<LoggedInProps> = ({}) => {
  const customizableDropdownButtonRef = useRef<any>(null);

  const items = [
    {
      name: 'Log Out',
      info: 'Log out of your PhenEx account. You can only edit cohorts when logged in.',
    },
  ];

  const loginService = LoginDataService.getInstance();

  const renderUserPanel = () => {
    return (
      <div className={styles.container}>
        <PopoverHeader
          onClick={clickedOnHeader}
          title={`@${loginService.getUsername()}`}
          className={styles.popoverheader}
        />
        <div className={styles.content}>
          <ItemList items={items} selectedName={undefined} onSelect={handleItemSelect} />
        </div>
      </div>
    );
  };

  const clickedOnHeader = () => {
    console.log('CLICKED ON HEADER', customizableDropdownButtonRef);
    customizableDropdownButtonRef.current?.closeDropdown();
  };

  const handleItemSelect = async (itemName: string) => {
    if (itemName === 'Log Out') {
      const loginService = LoginDataService.getInstance();
      await loginService.logout();
      // The auth state change will automatically update the UI
      // No need to force reload with Supabase
    }
  };

  return (
    <CustomizableDropdownButton
      key={'login'}
      label={`@${loginService.getUsername()}`}
      content={renderUserPanel()}
      ref={customizableDropdownButtonRef}
      menuClassName={styles.userDropdownMenu}
    />
  );
};
