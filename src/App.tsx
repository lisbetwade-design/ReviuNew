import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { InboxPage } from './pages/InboxPage';
import { BoardPage } from './pages/BoardPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { DesignViewerPage } from './pages/DesignViewerPage';
import { FolderViewerPage } from './pages/FolderViewerPage';
import { PublicFeedbackPage } from './pages/PublicFeedbackPage';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Pricing } from './pages/Pricing';
import { Success } from './pages/Success';

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/designs/:designId" element={<DesignViewerPage />} />
        <Route path="/folders/:folderId" element={<FolderViewerPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/board" element={<BoardPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/success" element={<Success />} />
        <Route path="/feedback/:token" element={<PublicFeedbackPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;