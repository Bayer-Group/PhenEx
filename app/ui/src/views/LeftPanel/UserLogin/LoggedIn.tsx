import { FC, useRef } from 'react';
import styles from './UserLogin.module.css';
import { CustomizableDropdownButton } from '../../../components/ButtonsAndTabs/ButtonsBar/CustomizableDropdownButton';
import { ItemList } from '../../../components/ItemList/ItemList';
import { LoginDataService } from './LoginDataService';
import { PopoverHeader } from '../../../components/PopoverHeader/PopoverHeader';

interface LoggedInProps {}

export const LoggedIn: FC<LoggedInProps> = ({}) => {
  const customizableDropdownButtonRef = useRef(null);

  const items = [
    {
      name: 'Log Out',
      info: 'Log out of your PhenEx account. You can only edit cohorts when logged in.',
    },
  ];

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

  const loginService = LoginDataService.getInstance();

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
      key={'login'}
      label={`@${loginService.getUsername()}`}
      content={renderUserPanel()}
      ref={customizableDropdownButtonRef}
      menuClassName={styles.userDropdownMenu}
    />
  );
};
