import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePortalAuth } from '@/context/PortalAuthContext';
import { ChatProvider } from '@/context/ChatContext';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Clients from '@/pages/Clients';
import ClientDetail from '@/pages/Clients/ClientDetail';
import Revenue from '@/pages/Revenue';
import Expenses from '@/pages/Expenses';
import Leads from '@/pages/Leads';
import Tasks from '@/pages/Tasks';
import Team from '@/pages/Team';
import Profile from '@/pages/Profile';
import ServicesSettings from '@/pages/Settings';
import Chat from '@/pages/Chat';
import Meetings from '@/pages/Meetings';
import CRM from '@/pages/CRM';

import PortalLogin from '@/pages/Portal/Login';
import PortalLayout from '@/pages/Portal/Layout';
import PortalDashboard from '@/pages/Portal/Dashboard';
import KPIs from '@/pages/Portal/KPIs';
import Content from '@/pages/Portal/Content';
import Updates from '@/pages/Portal/Updates';
import Invoices from '@/pages/Portal/Invoices';
import PortalMeetings from '@/pages/Portal/Meetings';
import ClientCrm from '@/pages/Portal/ClientCrm';

import PortalClientsPage from '@/pages/Admin/PortalClients';
import ClientPortalDetail from '@/pages/Admin/PortalClients/ClientPortalDetail';
import MyOrders from '@/pages/MyOrders';

function Spinner() {
  return (
    <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0f1e]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function ManagerRoute({ children }: { children: React.ReactNode }) {
  const { isManager, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isManager) return <Navigate to="/tasks" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAdmin) return <Navigate to="/tasks" replace />;
  return <>{children}</>;
}

function PortalRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = usePortalAuth();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/portal/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();
  const { user: portalUser } = usePortalAuth();

  return (
    <ChatProvider>
      <Routes>
        {/* Agency App */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<ManagerRoute><Dashboard /></ManagerRoute>} />
          <Route path="clients" element={<ManagerRoute><Clients /></ManagerRoute>} />
          <Route path="clients/:id" element={<ManagerRoute><ClientDetail /></ManagerRoute>} />
          <Route path="revenue" element={<ManagerRoute><Revenue /></ManagerRoute>} />
          <Route path="expenses" element={<ManagerRoute><Expenses /></ManagerRoute>} />
          <Route path="leads" element={<ManagerRoute><Leads /></ManagerRoute>} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="my-orders" element={<MyOrders />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="crm" element={<ManagerRoute><CRM /></ManagerRoute>} />
          <Route path="chat" element={<Chat />} />
          <Route path="chat/:type/:id" element={<Chat />} />
          <Route path="profile" element={<Profile />} />
          <Route path="team" element={<AdminRoute><Team /></AdminRoute>} />
          <Route path="settings/services" element={<AdminRoute><ServicesSettings /></AdminRoute>} />
          <Route path="portal-admin" element={<ManagerRoute><PortalClientsPage /></ManagerRoute>} />
          <Route path="portal-admin/:clientId" element={<ManagerRoute><ClientPortalDetail /></ManagerRoute>} />
        </Route>

        {/* Client Portal */}
        <Route path="/portal/login" element={portalUser ? <Navigate to="/portal" replace /> : <PortalLogin />} />
        <Route path="/portal" element={<PortalRoute><PortalLayout /></PortalRoute>}>
          <Route index element={<PortalDashboard />} />
          <Route path="analytics" element={<KPIs />} />
          <Route path="content" element={<Content />} />
          <Route path="updates" element={<Updates />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="orders" element={<ClientCrm />} />
          <Route path="meetings" element={<PortalMeetings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ChatProvider>
  );
}
