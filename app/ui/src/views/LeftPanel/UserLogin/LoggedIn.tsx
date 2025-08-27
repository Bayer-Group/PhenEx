import { FC } from 'react';
import { UserButton } from '../../../components/User';
import styles from './UserLogin.module.css';

interface LoggedInProps {}

export const LoggedIn: FC<LoggedInProps> = ({}) => {
  return (
    <div className={styles.container}>
      <UserButton className={styles.userButton} />
    </div>
  );
};
