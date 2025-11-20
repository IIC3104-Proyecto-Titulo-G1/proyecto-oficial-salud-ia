import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { consoleLogDebugger } from '@/lib/utils';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    consoleLogDebugger("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-gray-600">Oops! Page not found</p>
        <Link to="/" className="text-crm underline hover:text-crm/80">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
