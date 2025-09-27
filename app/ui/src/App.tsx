import './App.css';
import { MainView } from './views/MainView/MainView';
import { FontLoadingWrapper } from './components/FontLoadingWrapper';

function App() {
  return (
    <FontLoadingWrapper>
      <MainView />
    </FontLoadingWrapper>
  );
}

export default App;
