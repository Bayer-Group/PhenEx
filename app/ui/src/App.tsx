import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainView } from './views/MainView/MainView';
import { FontLoadingWrapper } from './components/FontLoadingWrapper';

function App() {
  return (
    <FontLoadingWrapper>
      <Routes>
        <Route path="/" element={<MainView />} />
        <Route path="/studies" element={<MainView />} />
        <Route path="/studies/:studyId" element={<MainView />} />
        <Route path="/studies/:studyId/cohorts/:cohortId" element={<MainView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </FontLoadingWrapper>
  );
}

export default App;
