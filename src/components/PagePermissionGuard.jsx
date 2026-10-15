import { usePermissions } from '@/lib/PermissionsContext';
import AccessDenied from '@/components/AccessDenied';

export default function PagePermissionGuard({ page, children }) {
  const { hasPage } = usePermissions();
  return hasPage(page) ? children : <AccessDenied />;
}
