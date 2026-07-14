import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Toaster } from 'sonner';

// Auth Pages
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';

// Public Pages
import PublicBooking from './pages/public/PublicBooking';
import PublicAppLayout from './pages/public/PublicAppLayout';
import BusinessHome from './pages/public/BusinessHome';

// Roles Dashboards
import EmployeeDashboard from './pages/staff/EmployeeDashboard';
import CustomerPortal from './pages/customer/CustomerPortal';
import PlatformAdmin from './pages/admin/PlatformAdmin';

// Onboarding
import OnboardingWizard from './pages/onboarding/OnboardingWizard';

// Dashboards
import OwnerDashboardLayout from './components/layouts/OwnerDashboardLayout';
import OwnerHome from './pages/owner/Home';
import Services from './pages/owner/Services';
import Staff from './pages/owner/Staff';
import Customers from './pages/owner/Customers';
import Calendar from './pages/owner/Calendar';
import Settings from './pages/owner/Settings';
import Reports from './pages/owner/Reports';
import Billing from './pages/owner/Billing';
import Products from './pages/owner/Products';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />; // Or an unauthorized page
  }

  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { businessMemberships, loading } = useAuth();

  if (loading) {
     return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // If user has no business, force them to onboard
  if (businessMemberships.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <Routes>
        {/* Public/Auth Routes */}
        <Route path="/" element={<Navigate to="/sign-in" replace />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />

        {/* Public Business App Routes */}
        <Route path="/app/:slug" element={<PublicAppLayout />}>
          <Route index element={<BusinessHome />} />
          <Route path="book" element={<PublicBooking />} />
          <Route path="account" element={<CustomerPortal />} />
        </Route>

        {/* Employee Route */}
        <Route 
          path="/staff-portal" 
          element={
            <ProtectedRoute allowedRoles={['Employee', 'Manager']}>
              <EmployeeDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Admin Route */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={['Platform Admin']}>
              <PlatformAdmin />
            </ProtectedRoute>
          } 
        />

        {/* Onboarding */}
        <Route 
          path="/onboarding" 
          element={
            <ProtectedRoute allowedRoles={['Business Owner']}>
              <OnboardingWizard />
            </ProtectedRoute>
          } 
        />

        {/* Owner Dashboard */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute allowedRoles={['Business Owner']}>
              <RequireOnboarding>
                <OwnerDashboardLayout />
              </RequireOnboarding>
            </ProtectedRoute>
          }
        >
          <Route index element={<OwnerHome />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="services" element={<Services />} />
          <Route path="staff" element={<Staff />} />
          <Route path="customers" element={<Customers />} />
          <Route path="products" element={<Products />} />
          <Route path="settings" element={<Settings />} />
          <Route path="billing" element={<Billing />} />
          <Route path="reports" element={<Reports />} />
          {/* We'll add more routes here later */}
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;