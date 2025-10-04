import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Plus, LogOut, User, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Caso {
  id: string;
  nombre_paciente: string;
  diagnostico_principal: string;
  estado: 'pendiente' | 'aceptado' | 'rechazado' | 'derivado';
  fecha_creacion: string;
}

export default function Dashboard() {
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const [casos, setCasos] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    loadCasos();
  }, [user, navigate]);

  const loadCasos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('casos')
      .select('id, nombre_paciente, diagnostico_principal, estado, fecha_creacion')
      .order('fecha_creacion', { ascending: false })
      .limit(10);

    if (!error && data) {
      setCasos(data);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getEstadoBadgeVariant = (estado: string) => {
    switch (estado) {
      case 'aceptado':
        return 'default';
      case 'rechazado':
        return 'destructive';
      case 'pendiente':
        return 'secondary';
      case 'derivado':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'aceptado':
        return 'Aceptado';
      case 'rechazado':
        return 'Rechazado';
      case 'pendiente':
        return 'Pendiente';
      case 'derivado':
        return 'Derivado a jefe';
      default:
        return estado;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary to-secondary text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-2xl font-bold">S</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">SaludIA</h1>
                <p className="text-sm text-white/80">Sistema de Ley de Urgencia</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {userRole === 'admin' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  <User className="w-4 h-4 mr-2" />
                  Gestión de Usuarios
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="bg-white/10 hover:bg-white/20 text-white border-white/30"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">Casos Clínicos</h2>
            <p className="text-muted-foreground">
              Gestiona y evalúa casos bajo la Ley de Urgencia
            </p>
          </div>
          {(userRole === 'medico' || userRole === 'medico_jefe') && (
            <Button onClick={() => navigate('/caso/nuevo')} size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Caso
            </Button>
          )}
        </div>

        {/* Casos List */}
        <div className="grid gap-4">
          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Cargando casos...</p>
              </CardContent>
            </Card>
          ) : casos.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium mb-2">No hay casos registrados</p>
                <p className="text-muted-foreground mb-4">
                  Comienza creando un nuevo caso clínico
                </p>
                {(userRole === 'medico' || userRole === 'medico_jefe') && (
                  <Button onClick={() => navigate('/caso/nuevo')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear primer caso
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            casos.map((caso) => (
              <Card
                key={caso.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/caso/${caso.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">
                        {caso.nombre_paciente}
                      </CardTitle>
                      <CardDescription className="text-base">
                        {caso.diagnostico_principal}
                      </CardDescription>
                    </div>
                    <Badge variant={getEstadoBadgeVariant(caso.estado)}>
                      {getEstadoLabel(caso.estado)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Fecha: {new Date(caso.fecha_creacion).toLocaleDateString('es-CL', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
