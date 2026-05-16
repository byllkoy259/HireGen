import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { App as AntdApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';

import ProtectedRoute from './components/common/ProtectedRoute';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import LandingPage from './pages/public/LandingPage';
import PublicProfileView from './pages/public/PublicProfile';
import AboutUs from './pages/public/AboutUs';
import Terms from './pages/public/Terms';

import HRDashboard from './pages/hr/HRDashboard';
import HRJobs from './pages/hr/HRJobs';
import HRCandidates from './pages/hr/HRCandidates';
import HRCandidateDetail from './pages/hr/HRCandidateDetail';
import HRCompanies from './pages/hr/HRCompanies';

import CandidateDashboard from './pages/candidate/CandidateDashboard';
import CandidateProfile from './pages/candidate/CandidateProfile';
import CandidateJobs from './pages/candidate/CandidateJobs';
import CandidateApplications from './pages/candidate/CandidateApplications';
import CandidateSavedJobs from './pages/candidate/CandidateSavedJobs';
import CandidateGuide from './pages/candidate/CandidateGuide';
import CandidateHelpCenter from './pages/candidate/CandidateHelpCenter';

import AdminHRs from './pages/admin/AdminHRs';
import AdminPartners from './pages/admin/AdminPartners';
import AdminProfile from './pages/admin/AdminProfile';
import HRProfile from './pages/hr/HRProfile';

const NotFound = () => <div style={{ padding: 20 }}>404 - Không tìm thấy trang</div>;

function App() {
  return (
    <ConfigProvider locale={viVN}>
      <AntdApp>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile/:id" element={<PublicProfileView />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/terms" element={<Terms />} />

            <Route element={<ProtectedRoute allowedRoles={['HR']} />}>
              <Route path="/hr" element={<HRDashboard />} />
              <Route path="/hr/jobs" element={<HRJobs />} />
              <Route path="/hr/candidates" element={<HRCandidates />} />
              <Route path="/hr/candidates/:id" element={<HRCandidateDetail />} />
              <Route path="/hr/companies" element={<HRCompanies />} />
              <Route path="/hr/profile" element={<HRProfile />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
              <Route path="/admin" element={<AdminHRs />} />
              <Route path="/admin/partners" element={<AdminPartners />} />
              <Route path="/admin/profile" element={<AdminProfile />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['Candidate']} />}>
              <Route path="/candidate" element={<CandidateDashboard />} />
              <Route path="/candidate/profile" element={<CandidateProfile />} />
              <Route path="/candidate/jobs" element={<CandidateJobs />} />
              <Route path="/candidate/applications" element={<CandidateApplications />} />
              <Route path="/candidate/saved" element={<CandidateSavedJobs />} />
              <Route path="/candidate/guide" element={<CandidateGuide />} />
              <Route path="/candidate/help" element={<CandidateHelpCenter />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;