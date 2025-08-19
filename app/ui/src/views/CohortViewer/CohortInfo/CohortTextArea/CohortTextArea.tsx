import { FC, useState, useEffect, useRef } from 'react';
import styles from './CohortTextArea.module.css';
import { CohortDataService } from '../../CohortDataService/CohortDataService';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

interface CohortTextAreaProps {}

export const CohortTextArea: FC<CohortTextAreaProps> = () => {
  const [text, setText] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill>();
  const dataService = CohortDataService.getInstance();

  useEffect(() => {
    let quillInstance: Quill | null = null;

    if (editorRef.current) {
      // Clean up any existing content
      while (editorRef.current.firstChild) {
        editorRef.current.removeChild(editorRef.current.firstChild);
      }

      const toolbarContainer = document.createElement('div');
      const editorContainer = document.createElement('div');
      editorRef.current.appendChild(toolbarContainer);
      editorRef.current.appendChild(editorContainer);

      quillInstance = new Quill(editorContainer, {
        theme: 'snow',
        placeholder: 'Enter cohort description...',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ indent: '-1' }, { indent: '+1' }],
            [{ header: [1, 2, 3, 4, 5, 6, false] }],
            [{ color: [] }, { background: [] }],
          ],
        },
      });

      quillRef.current = quillInstance;

      // Initial load of text from data service
      const delta = dataService.cohort_data.description || null;
      if (delta) {
        quillInstance.setContents(delta);
      }

      // Handle text changes
      quillInstance.on('text-change', () => {
        const delta = quillInstance?.getContents();
        dataService.cohort_data.description = delta;
        dataService.saveChangesToCohort();
      });
    }

    // Subscribe to data service changes
    const updateText = () => {
      const delta = dataService.cohort_data.description || null;
      if (quillRef.current) {
        if (delta) {
          // Get current selection to preserve cursor position
          const selection = quillRef.current.getSelection();
          // Only update if content is actually different
          const currentContents = quillRef.current.getContents();
          if (JSON.stringify(currentContents) !== JSON.stringify(delta)) {
            quillRef.current.setContents(delta);
            // Restore selection if it was preserved
            if (selection) {
              quillRef.current.setSelection(selection);
            }
          }
        } else {
          // Clear the editor when data is null
          quillRef.current.setText('');
        }
      }
    };
    dataService.addListener(updateText);

    return () => {
      if (quillInstance) {
        quillInstance.off('text-change');
      }
      if (editorRef.current) {
        while (editorRef.current.firstChild) {
          editorRef.current.removeChild(editorRef.current.firstChild);
        }
      }
      dataService.removeListener(updateText);
    };
  }, []); // Remove dataService.cohort_data from dependencies

  return (
    <div className={styles.textAreaContainer}>
      <h1 className={styles.title}>Description</h1>
      <div ref={editorRef} className={styles.editor} />
    </div>
  );
};
