import { FC, useState, useEffect, useRef } from 'react';
import styles from '../CohortTextArea/CohortTextArea.module.css';
import { StudyDataService } from '../../../StudyViewer/StudyDataService';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

export const StudyTextArea: FC = () => {
  const [isFocused, setIsFocused] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const dataService = StudyDataService.getInstance();

  useEffect(() => {
    let quillInstance: Quill | null = null;
    let keyDownHandler: ((e: KeyboardEvent) => void) | null = null;

    if (editorRef.current) {
      while (editorRef.current.firstChild) {
        editorRef.current.removeChild(editorRef.current.firstChild);
      }

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
        <select class="ql-color"><option selected></option></select>
        <select class="ql-background"><option selected></option></select>
        <button class="ql-link"></button>
        <button class="ql-clean"></button>
      `;

      const editorContainer = document.createElement('div');
      editorContainer.className = styles.editorContent;

      editorRef.current.appendChild(toolbarContainer);
      editorRef.current.appendChild(editorContainer);

      quillInstance = new Quill(editorContainer, {
        theme: 'snow',
        placeholder: 'Enter study description...',
        modules: { toolbar: `#${toolbarContainer.id}` },
      });

      quillRef.current = quillInstance;

      const loadDescription = () => {
        const raw = dataService.study_data?.description || null;
        if (!raw || !quillRef.current) return;
        try {
          const delta = typeof raw === 'string' ? JSON.parse(raw) : raw;
          quillRef.current.setContents(delta);
        } catch {
          quillRef.current.setText(typeof raw === 'string' ? raw : '');
        }
      };

      loadDescription();

      quillInstance.on('text-change', () => {
        const delta = quillInstance?.getContents();
        dataService.study_data.description = JSON.stringify(delta);
        dataService.saveChangesToStudy(true, false);
      });

      keyDownHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          quillInstance?.blur();
          setIsFocused(false);
        }
      };
      editorContainer.addEventListener('keydown', keyDownHandler);

      let hideTimeoutId: number | null = null;

      quillInstance.on('selection-change', range => {
        if (range) {
          if (hideTimeoutId) { clearTimeout(hideTimeoutId); hideTimeoutId = null; }
          setIsFocused(true);
        } else {
          hideTimeoutId = setTimeout(() => {
            const activeElement = document.activeElement;
            if (!(activeElement && toolbarContainer.contains(activeElement))) {
              setIsFocused(false);
            }
            hideTimeoutId = null;
          }, 100);
        }
      });

      toolbarContainer.addEventListener('mousedown', e => {
        e.preventDefault();
        if (hideTimeoutId) { clearTimeout(hideTimeoutId); hideTimeoutId = null; }
        setIsFocused(true);
        setTimeout(() => quillInstance?.focus(), 50);
      });
    }

    const updateText = () => {
      const raw = dataService.study_data?.description || null;
      if (quillRef.current) {
        if (raw) {
          try {
            const delta = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const currentContents = quillRef.current.getContents();
            if (JSON.stringify(currentContents) !== JSON.stringify(delta)) {
              const selection = quillRef.current.getSelection();
              quillRef.current.setContents(delta);
              if (selection) quillRef.current.setSelection(selection);
            }
          } catch {
            quillRef.current.setText(typeof raw === 'string' ? raw : '');
          }
        } else {
          quillRef.current.setText('');
        }
      }
    };
    dataService.addStudyDataServiceListener(updateText);
    // Call immediately in case study data was loaded before this component mounted
    updateText();

    return () => {
      if (quillInstance) {
        quillInstance.off('text-change');
        quillInstance.off('selection-change');
      }
      if (editorRef.current) {
        const editorContainer = editorRef.current.querySelector(`.${styles.editorContent}`) as HTMLElement;
        if (editorContainer && keyDownHandler) {
          editorContainer.removeEventListener('keydown', keyDownHandler);
        }
        while (editorRef.current.firstChild) {
          editorRef.current.removeChild(editorRef.current.firstChild);
        }
      }
      dataService.removeStudyDataServiceListener(updateText);
    };
  }, []);

  return (
    <div className={styles.textAreaContainer}>
      <div ref={editorRef} className={`${styles.quillEditor} ${isFocused ? styles.focused : ''}`} />
    </div>
  );
};
