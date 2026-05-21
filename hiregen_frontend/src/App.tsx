import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { App as AntdApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';

import ProtectedRoute from './components/common/ProtectedRoute';
import ScrollToTop from './components/layouts/ScrollToTop';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import LandingPage from './pages/public/LandingPage';

import AboutUs from './pages/public/AboutUs';
import Terms from './pages/public/Terms';
import Guide from './pages/public/Guide';
import HelpCenter from './pages/public/HelpCenter';
import PublicJobs from './pages/public/PublicJobs';

import HRDashboard from './pages/hr/HRDashboard';
import HRJobs from './pages/hr/HRJobs';
import HRCandidates from './pages/hr/HRCandidates';
import HRCandidateDetail from './pages/hr/HRCandidateDetail';
import HRCompanies from './pages/hr/HRCompanies';
import HRAIMatching from './pages/hr/HRAIMatching';
import HRReports from './pages/hr/HRReports';

import CandidateDashboard from './pages/candidate/CandidateDashboard';
import CandidateProfile from './pages/candidate/CandidateProfile';
import CandidateJobs from './pages/candidate/CandidateJobs';
import CandidateApplications from './pages/candidate/CandidateApplications';
import CandidateSavedJobs from './pages/candidate/CandidateSavedJobs';
import CandidateGuide from './pages/candidate/CandidateGuide';
import CandidateHelpCenter from './pages/candidate/CandidateHelpCenter';
import PublicProfileView from './pages/candidate/PublicProfile';

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
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/help" element={<HelpCenter />} />
            <Route path="/jobs" element={<PublicJobs />} />
            <Route path="/profile/:id" element={<PublicProfileView />} />

            <Route element={<ProtectedRoute allowedRoles={['HR']} />}>
              <Route path="/hr" element={<HRDashboard />} />
              <Route path="/hr/jobs" element={<HRJobs />} />
              <Route path="/hr/candidates" element={<HRCandidates />} />
              <Route path="/hr/candidates/:id" element={<HRCandidateDetail />} />
              <Route path="/hr/companies" element={<HRCompanies />} />
              <Route path="/hr/ai-matching" element={<HRAIMatching />} />
              <Route path="/hr/reports" element={<HRReports />} />
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
              <Route path="/candidate/profile/:id" element={<PublicProfileView />} />
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
