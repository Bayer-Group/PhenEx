import { createRoot } from 'react-dom/client';
import '../../index.css';
import '../../styles/variables.css';
import '../../styles/fonts.css';
import { StaticReportViewer } from './StaticReportViewer';

createRoot(document.getElementById('root')!).render(<StaticReportViewer />);
