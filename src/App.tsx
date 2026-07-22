import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';

import IndustrySelection from './pages/marketing/IndustrySelection';
import BusinessTypeSelection from './pages/marketing/BusinessTypeSelection';
import Pricing from './pages/marketing/Pricing';
import WhyVelliqo from './pages/marketing/WhyVelliqo';
import Experience from './pages/marketing/Experience';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import CheckEmail from './pages/auth/CheckEmail';
import EmailConfirmed from './pages/auth/EmailConfirmed';
import PublicBooking from './pages/public/PublicBooking';
import PublicAppLayout from './pages/public/PublicAppLayout';
import BusinessHome from './pages/public/BusinessHome';
import EmployeeDashboard from './pages/staff/EmployeeDashboard';
import CustomerPortal from './pages/customer/CustomerPortal';
import PlatformAdmin from './pages/admin/PlatformAdmin';
import OnboardingWizard from './pages/onboarding/OnboardingWizard';
import OwnerDashboardLayout from './components/layouts/OwnerDashboardLayout';
import OwnerHome from './pages/owner/Home';
import Services from './pages/owner/Services';
import Staff from './pages/owner/Staff';
import Customers from './pages/owner/Customers';
import CustomerProfile from './pages/owner/CustomerProfile';
import Calendar from './pages/owner/Calendar';
import Reports from './pages/owner/Reports';
import Billing from './pages/owner/Billing';
import Products from './pages/owner/Products';
import Posts from './pages/owner/Posts';
import Gallery from './pages/owner/Gallery';
import Storefront from './pages/owner/Storefront';
import Business from './pages/owner/Business';
import Settings from './pages/owner/Settings';
import AIHub from './pages/owner/ai/AIHub';
import AISettings from './pages/owner/ai/AISettings';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, profile, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) return <div className="flex min-h-screen items-center justify-center">{t('system.loading')}</div>;
  if (!user) return <Navigate to="/sign-in" replace />;
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { businessMemberships, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) return <div className="flex min-h-screen items-center justify-center">{t('system.loading')}</div>;
  if (businessMemberships.length === 0) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <Routes>
        <Route path="/" element={<IndustrySelection />} />
        <Route path="/business-types" element={<BusinessTypeSelection />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/why-velliqo" element={<WhyVelliqo />} />
        <Route path="/experience" element={<Experience />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/auth/confirmed" element={<EmailConfirmed />} />

        <Route path="/app/:slug" element={<PublicAppLayout />}>
          <Route index element={<BusinessHome />} />
          <Route path="book" element={<PublicBooking />} />
          <Route path="account" element={<CustomerPortal />} />
        </Route>

        <Route path="/staff-portal" element={<ProtectedRoute allowedRoles={['Employee', 'Manager']}><EmployeeDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['Platform Admin']}><PlatformAdmin /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute allowedRoles={['Business Owner']}><OnboardingWizard /></ProtectedRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['Business Owner']}><RequireOnboarding><OwnerDashboardLayout /></RequireOnboarding></ProtectedRoute>}>
          <Route index element={<OwnerHome />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="services" element={<Services />} />
          <Route path="staff" element={<Staff />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:customerId" element={<CustomerProfile />} />
          <Route path="products" element={<Products />} />
          <Route path="posts" element={<Posts />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="storefront" element={<Storefront />} />
          <Route path="business" element={<Business />} />
          <Route path="billing" element={<Billing />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="ai" element={<AIHub />} />
          <Route path="ai/settings" element={<AISettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
