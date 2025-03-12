import { FC, useState, useEffect, useRef } from 'react';
import styles from './CohortTextArea.module.css';
import { CohortDataService } from '../../CohortDataService';
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
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'indent': '-1'}, { 'indent': '+1' }],
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            [{ 'color': [] }, { 'background': [] }],
          ]
        }
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
      if (delta && quillRef.current) {
        quillRef.current.setContents(delta);
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
  }, [dataService.cohort_data]);

  return (
    <div className={styles.textAreaContainer}>
      <h1 className={styles.title}>Description</h1>
      <div ref={editorRef} className={styles.editor} />
    </div>
  );
};