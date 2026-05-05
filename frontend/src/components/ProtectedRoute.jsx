import { Navigate } from "react-router-dom";

function ProtectedRoute({ user, loading, children }) {
  if (loading) {
    return <h2>Loading...</h2>; // 🔥 WAIT
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
}

export default ProtectedRoute;