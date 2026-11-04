import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  const allowed = roles?.includes(user.role)
    || (user.role === "superadmin" && roles?.includes("admin"));
  if (roles && !allowed) return <Navigate to="/" replace />;
  return children;
}
