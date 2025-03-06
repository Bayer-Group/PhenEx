import { FC } from 'react';
import styles from './ButtonsBar.module.css';
import { DropdownButton } from './DropdownButton';

interface ButtonsBarWithDropdownsProps {
  width: string | number;
  height: string | number;
  buttons: string[];
  actions: (() => void)[];
  dropdown_items: (string[] | null)[];
  onDropdownSelection?: (buttonIndex: number, selectedItem: string) => void;
}

export const ButtonsBarWithDropdowns: FC<ButtonsBarWithDropdownsProps> = ({
  width,
  height,
  buttons,
  actions,
  dropdown_items,
  onDropdownSelection,
}) => {
  return (
    <div
      className={styles.buttonsContainer}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
      }}
    >
      {buttons.map((button, index) => {
        if (!dropdown_items[index]) {
          return (
            <button
              key={index}
              className={styles.button}
              onClick={() => actions[index]()}
            >
              {button}
            </button>
          );
        } else {
          return (
            <DropdownButton
              key={index}
              label={button}
              items={dropdown_items[index] || []}
              onSelection={(item) => onDropdownSelection?.(index, item)}
            />
          );
        }
      })}
    </div>
  );
};