import { FC, useState, useEffect, useRef } from 'react';
import styles from './CohortTextArea.module.css';
import { CohortDataService } from '../../../CohortViewer/CohortDataService/CohortDataService';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

interface CohortTextAreaProps {}

export const CohortTextArea: FC<CohortTextAreaProps> = () => {
  const [isFocused, setIsFocused] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const dataService = CohortDataService.getInstance();

  useEffect(() => {
    let quillInstance: Quill | null = null;
    let keyDownHandler: ((e: KeyboardEvent) => void) | null = null;

    if (editorRef.current) {
      // Clean up any existing content
      while (editorRef.current.firstChild) {
        editorRef.current.removeChild(editorRef.current.firstChild);
      }

      // Create toolbar container HTML
      const toolbarContainer = document.createElement('div');
      toolbarContainer.id = 'toolbar-' + Math.random().toString(36).substr(2, 9);
      toolbarContainer.className = styles.stickyToolbar;
      toolbarContainer.innerHTML = `
        <button class="ql-bold"></button>
        <button class="ql-italic"></button>
        <button class="ql-underline"></button>
        <button class="ql-list" value="ordered"></button>
        <button class="ql-list" value="bullet"></button>
        <button class="ql-indent" value="-1"></button>
        <button class="ql-indent" value="+1"></button>
        <select class="ql-header">
          <option selected></option>
          <option value="1"></option>
          <option value="2"></option>
          <option value="3"></option>
          <option value="4"></option>
          <option value="5"></option>
          <option value="6"></option>
        </select>
        <select class="ql-color">
          <option selected></option>
        </select>
        <select class="ql-background">
          <option selected></option>
        </select>
      `;

      // Create editor container
      const editorContainer = document.createElement('div');
      editorContainer.className = styles.editorContent;

      // Add both to the main container
      editorRef.current.appendChild(toolbarContainer);
      editorRef.current.appendChild(editorContainer);

      // Initialize Quill with the custom toolbar
      quillInstance = new Quill(editorContainer, {
        theme: 'snow',
        placeholder: 'Enter cohort description...',
        modules: {
          toolbar: `#${toolbarContainer.id}`,
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

      // Handle escape key to unfocus
      keyDownHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          quillInstance?.blur();
          setIsFocused(false);
        }
      };
      
      // Add escape key listener to the editor container
      editorContainer.addEventListener('keydown', keyDownHandler);

      // Handle focus/blur events for toolbar visibility
      let hideTimeoutId: number | null = null;

      quillInstance.on('selection-change', range => {
        if (range) {
          // Focus gained
          if (hideTimeoutId) {
            clearTimeout(hideTimeoutId);
            hideTimeoutId = null;
          }
          setIsFocused(true);
        } else {
          // Focus lost - but delay hiding to check if click was on toolbar
          hideTimeoutId = setTimeout(() => {
            // Check if the active element is within the toolbar
            const activeElement = document.activeElement;
            const isToolbarClick = activeElement && toolbarContainer.contains(activeElement);

            if (!isToolbarClick) {
              setIsFocused(false);
            }
            hideTimeoutId = null;
          }, 100); // Small delay to allow toolbar clicks to be detected
        }
      });

      // Prevent toolbar from losing focus when clicking toolbar elements
      toolbarContainer.addEventListener('mousedown', e => {
        e.preventDefault(); // Prevent focus loss
        if (hideTimeoutId) {
          clearTimeout(hideTimeoutId);
          hideTimeoutId = null;
        }
        // Keep the toolbar visible
        setIsFocused(true);

        // Re-focus the editor after a brief delay to allow toolbar action
        setTimeout(() => {
          quillInstance?.focus();
        }, 50);
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
        quillInstance.off('selection-change');
      }
      if (editorRef.current) {
        // Remove keydown listener if it exists
        const editorContainer = editorRef.current.querySelector(`.${styles.editorContent}`) as HTMLElement;
        if (editorContainer && keyDownHandler) {
          editorContainer.removeEventListener('keydown', keyDownHandler);
        }
        
        while (editorRef.current.firstChild) {
          editorRef.current.removeChild(editorRef.current.firstChild);
        }
      }
      dataService.removeListener(updateText);
    };
  }, []); // Remove dataService.cohort_data from dependencies

  return (
    <div className={styles.textAreaContainer}>
      <div ref={editorRef} className={`${styles.quillEditor} ${isFocused ? styles.focused : ''}`} />
    </div>
  );
};
