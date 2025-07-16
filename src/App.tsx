import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import Movies from './pages/Movies';
import Shows from './pages/Shows';
import Search from './pages/Search';
import AdminPanel from './components/admin/AdminPanel';
import NotFound from './pages/NotFound';

import Footer from './components/Footer';
import FloatingSocialButtons from './components/FloatingSocialButtons';
import AnnouncementBar from './components/AnnouncementBar';
import { Toaster } from "@/components/ui/toaster";
import useAdminSettings from './hooks/useAdminSettings';

// Create a client
const queryClient = new QueryClient();

// Layout component to conditionally render Navigation
const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');
  const { settings: adminSettings } = useAdminSettings();

  return (
    <div className="min-h-screen bg-background">
      {/* Announcement Bar - Always on top */}
      {!isAdminPage && adminSettings && (
        <AnnouncementBar 
          text={adminSettings.appearance?.announcementBar?.text || ''}
          enabled={adminSettings.appearance?.announcementBar?.enabled || false}
          backgroundColor={adminSettings.appearance?.announcementBar?.backgroundColor || '#3b82f6'}
          textColor={adminSettings.appearance?.announcementBar?.textColor || '#ffffff'}
        />
      )}
      
      {/* Navigation - Below announcement bar, sticky */}
      {!isAdminPage && <Navigation />}
      
      {/* Main content - No fixed padding needed since navbar is sticky */}
      <main className="w-full">
        {children}
      </main>
      
      {!isAdminPage && <Footer />}
      {!isAdminPage && adminSettings && (
        <FloatingSocialButtons 
          enabled={adminSettings.appearance?.floatingSocialButtons?.enabled || true}
          discordLink={adminSettings.appearance?.floatingSocialButtons?.discordUrl || 'https://discord.gg/cinema-fo'}
          telegramLink={adminSettings.appearance?.floatingSocialButtons?.telegramUrl || 'https://t.me/cinema-fo'}
        />
      )}
      <Toaster />
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/shows" element={<Shows />} />
            <Route path="/search" element={<Search />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
