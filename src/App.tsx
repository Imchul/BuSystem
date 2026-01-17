import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PolicyDetail from './pages/PolicyDetail';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <header className="header">
          <div className="header-content">
            <div className="header-actions">
              <a
                href="https://www.moef.go.kr/com/cmm/fms/FileDown.do;jsessionid=r8OD_1yTF4zCivL2qLe6w6k80_wxYa5Eg6vUgKC2.node40?atchFileId=ATCH_000000000030674&fileSn=3"
                target="_blank"
                rel="noopener noreferrer"
                className="pdf-download-btn"
              >
                📥 2026 정책 원본 PDF
              </a>
            </div>
            <h1>2026년부터 이렇게 달라집니다</h1>
            <p className="subtitle">나이와 성별에 맞는 정책 정보를 찾아보세요</p>
          </div>
        </header>

        <main className="main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/policy/:id" element={<PolicyDetail />} />
          </Routes>
        </main>

        <footer className="footer">
          <p>
            자료 출처: 기획재정부 「2026년부터 이렇게 달라집니다」
          </p>
          <p className="footer-note">
            본 사이트는 정보 제공 목적으로 제작되었습니다. 정확한 내용은 해당 부처에 문의하세요.
          </p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
