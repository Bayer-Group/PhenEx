import { FC, useEffect, useState } from 'react';
import styles from './DirectorySelectionButton.module.css';
import { DirectoryReaderWriterService } from '../DirectoryReaderWriterService';

interface DirectorySelectionButtonProps {}

// Define the DirectorySelectionButton component with TypeScript props
export const DirectorySelectionButton: FC<DirectorySelectionButtonProps> = () => {
  // Get singleton instance of the directory service
  const directoryService = DirectoryReaderWriterService.getInstance();
  // State to store the display path shown in the button
  const [displayPath, setDisplayPath] = useState<string>('');

  // Handler for when user clicks to select a new directory
  const handleDirectorySelection = async () => {
    try {
      // Open system directory picker and get selected directory
      const selectedPath = await DirectoryPickerService.selectDirectory();
      // Update the directory service with new selection
      await directoryService.setSelectedDirectory(selectedPath);
      // Notify parent component of selection
      // Update display with new directory name
      setDisplayPath(selectedPath.name);
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  };

  // Render the directory selection button
  return (
    <div
      className={`${styles.container} ${!displayPath ? styles.noSelection : ''}`}
      onClick={handleDirectorySelection}
    >
      <div className={styles.selectionButton}>{displayPath || 'Select a directory'}</div>
      <button className={styles.editButton}>
        <img src="src/assets/icons/edit-pencil.svg" alt="edit" />
      </button>
    </div>
  );
};

class DirectoryPickerService {
  static async selectDirectory(): Promise<FileSystemDirectoryHandle> {
    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      return dirHandle;
    } catch (error) {
      console.error('Error selecting directory:', error);
      throw error;
    }
  }
}
