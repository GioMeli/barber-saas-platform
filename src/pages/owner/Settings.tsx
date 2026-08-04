import { Navigate } from 'react-router-dom';

/**
 * Legacy compatibility shim.
 *
 * Owner configuration is maintained from Storefront. Keeping this tiny redirect
 * prevents old bookmarks or stale client links from reopening a second source
 * of truth for business profile and booking configuration.
 */
export default function Settings() {
  return <Navigate to="/dashboard/storefront" replace />;
}
