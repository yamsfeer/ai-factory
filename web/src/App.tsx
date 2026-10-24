import { Navigate, Route, Routes } from 'react-router-dom';
import { Header, Sidebar } from './layout/Layout';
import { ToastProvider } from './ui/feedback';
import RoomBuildoutPage from './pages/room/RoomBuildoutPage';
import ClusterDeliveryPage from './pages/delivery/ClusterDeliveryPage';

export default function App() {
  return (
    <ToastProvider>
      <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
        <Header />
        <div className="flex app-shell">
          <Sidebar />
          <main className="flex-1 min-w-0 p-5 space-y-5 app-main" id="main">
            <Routes>
              <Route path="/" element={<Navigate to="/room-buildout" replace />} />
              <Route path="/room-buildout" element={<RoomBuildoutPage />} />
              <Route path="/cluster-delivery" element={<ClusterDeliveryPage />} />
              <Route path="*" element={<Navigate to="/room-buildout" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
