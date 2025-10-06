import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, LogOut, Users, User as UserIcon, FileText, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Caso {
  id: string;
  nombre_paciente: string;
  diagnostico_principal: string;
  estado: 'pendiente' | 'aceptado' | 'rechazado' | 'derivado';
  fecha_creacion: string;
}

type EstadoFiltro = 'todos' | 'pendiente' | 'aceptado' | 'rechazado' | 'derivado';

export default function Dashboard() {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos');
  const { user, userRole, userRoleData, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const filtrosActivos = searchTerm.trim() !== '' || estadoFiltro !== 'todos';

  const loadCasos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('casos')
      .select('*')
      .order('fecha_creacion', { ascending: false })
      .limit(10);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los casos",
        variant: "destructive",
      });
    } else {
      setCasos(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Bloquear acceso a admins
    if (userRole === 'admin') {
      toast({
        title: 'Acceso denegado',
        description: 'Los administradores deben usar el panel de administración',
        variant: 'destructive',
      });
      navigate('/admin');
      return;
    }

    loadCasos();
  }, [user, userRole, navigate, loadCasos, toast]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const filteredCasos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return casos.filter((caso) => {
      const matchesEstado = estadoFiltro === 'todos' || caso.estado === estadoFiltro;

      if (!matchesEstado) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const hayCoincidencia = `${caso.nombre_paciente} ${caso.diagnostico_principal}`
        .toLowerCase()
        .includes(normalizedSearch);

      return hayCoincidencia;
    });
  }, [casos, estadoFiltro, searchTerm]);

  const casosPorEstado = useMemo(() => {
    return casos.reduce(
      (acc, caso) => {
        acc[caso.estado] += 1;
        return acc;
      },
      { aceptado: 0, rechazado: 0, pendiente: 0, derivado: 0 }
    );
  }, [casos]);

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
        return 'Ley de Urgencia Aceptada';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando casos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header profesional con degradado sutil */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div>
                  <img 
                    src="/logo.jpeg" 
                    alt="SaludIA Logo" 
                    className="w-14 h-14 object-contain"
                  />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-[#3101ff] to-[#cb6ce6] bg-clip-text text-transparent">
                  SaludIA
                </h1>
                <p className="text-sm text-muted-foreground font-medium">
                  {userRoleData?.nombre} • {userRole === 'medico_jefe' ? 'Médico Jefe' : userRole === 'medico' ? 'Médico' : 'Administrador'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              {userRole === 'admin' && (
                <Button variant="outline" size="sm" onClick={() => navigate('/admin')} className="gap-2">
                  <Users className="h-4 w-4" />
                  Usuarios
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => navigate('/perfil')} className="gap-2">
                <UserIcon className="h-4 w-4" />
                Mi Perfil
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content con diseño moderno */}
      <main className="container mx-auto px-6 py-10 max-w-7xl">
        {/* Stats Cards Grid mejorado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* Total Casos */}
          <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/5 hover:shadow-xl transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all"></div>
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-primary/10 ring-1 ring-primary/20">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="outline" className="text-xs font-semibold border-primary/30 text-primary">
                  Total
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Casos Registrados</p>
                <p className="text-4xl font-bold text-foreground">{casos.length}</p>
              </div>
            </CardContent>
          </Card>

          {/* Aceptados */}
          <Card className="relative overflow-hidden border-success/20 bg-gradient-to-br from-card to-success/5 hover:shadow-xl transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-success/10 rounded-full blur-3xl group-hover:bg-success/20 transition-all"></div>
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-success/10 ring-1 ring-success/20">
                  <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <Badge variant="outline" className="text-xs font-semibold border-success/30 text-success">
                  Aprobados
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Casos Aceptados</p>
                <p className="text-4xl font-bold text-foreground">
                  {casosPorEstado.aceptado}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Rechazados: {casosPorEstado.rechazado}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Pendientes */}
          <Card className="relative overflow-hidden border-warning/20 bg-gradient-to-br from-card to-warning/5 hover:shadow-xl transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-warning/10 rounded-full blur-3xl group-hover:bg-warning/20 transition-all"></div>
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-warning/10 ring-1 ring-warning/20">
                  <svg className="w-6 h-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <Badge variant="outline" className="text-xs font-semibold border-warning/30 text-warning">
                  En Espera
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Casos Pendientes</p>
                <p className="text-4xl font-bold text-foreground">
                  {casosPorEstado.pendiente}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Derivados */}
          <Card className="relative overflow-hidden border-secondary/20 bg-gradient-to-br from-card to-secondary/5 hover:shadow-xl transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl group-hover:bg-secondary/20 transition-all"></div>
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-secondary/10 ring-1 ring-secondary/20">
                  <UserIcon className="w-6 h-6 text-secondary" />
                </div>
                <Badge variant="outline" className="text-xs font-semibold border-secondary/30 text-secondary">
                  Derivados
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Casos Derivados</p>
                <p className="text-4xl font-bold text-foreground">
                  {casosPorEstado.derivado}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Header de lista mejorado */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-2 text-foreground">Casos Recientes</h2>
            <p className="text-muted-foreground">
              Gestiona y evalúa casos clínicos bajo la Ley de Urgencia
            </p>
          </div>
          {(userRole === 'medico' || userRole === 'medico_jefe') && (
            <Button onClick={() => navigate('/caso/nuevo')} size="lg" className="gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
              <Plus className="w-5 h-5" />
              Nuevo Caso
            </Button>
          )}
        </div>

        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="relative sm:max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por paciente o diagnóstico"
                className="pl-10"
              />
            </div>
            <Select value={estadoFiltro} onValueChange={(value) => setEstadoFiltro(value as EstadoFiltro)}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="aceptado">Aceptado</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
                <SelectItem value="derivado">Derivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Mostrando <span className="font-semibold text-foreground">{filteredCasos.length}</span> de {casos.length} casos
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setEstadoFiltro('todos');
              }}
              disabled={!filtrosActivos}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>

        {/* Lista de casos mejorada */}
        {casos.length === 0 ? (
          <Card className="border-dashed border-2 border-muted-foreground/30 bg-muted/20">
            <CardContent className="p-16 text-center">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center ring-1 ring-primary/20">
                <FileText className="w-12 h-12 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground">No hay casos registrados</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Comienza creando un nuevo caso clínico para evaluar bajo la Ley de Urgencia
              </p>
              {(userRole === 'medico' || userRole === 'medico_jefe') && (
                <Button onClick={() => navigate('/caso/nuevo')} size="lg" className="gap-2">
                  <Plus className="w-5 h-5" />
                  Crear Primer Caso
                </Button>
              )}
            </CardContent>
          </Card>
        ) : filteredCasos.length === 0 ? (
          <Card className="border-dashed border-2 border-muted-foreground/30 bg-muted/20">
            <CardContent className="p-12 text-center space-y-3">
              <h3 className="text-xl font-semibold text-foreground">Sin coincidencias</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                No encontramos casos que coincidan con los filtros seleccionados. Ajusta los criterios e inténtalo nuevamente.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setEstadoFiltro('todos');
                }}
              >
                Limpiar filtros
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5">
            {filteredCasos.map((caso) => (
              <Card
                key={caso.id}
                className="relative overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-border/50 hover:border-primary/40 group bg-card"
                onClick={() => navigate(`/caso/${caso.id}`)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <CardContent className="p-7 relative">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xl font-bold group-hover:text-primary transition-colors mb-2 truncate text-foreground">
                            {caso.nombre_paciente}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                            {caso.diagnostico_principal}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-4">
                        <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg ring-1 ring-border/50">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(caso.fecha_creacion).toLocaleDateString('es-CL', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg ring-1 ring-border/50">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {new Date(caso.fecha_creacion).toLocaleTimeString('es-CL', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                    <Badge 
                      variant={getEstadoBadgeVariant(caso.estado)}
                      className="flex-shrink-0 px-4 py-2 text-xs font-semibold"
                    >
                      {getEstadoLabel(caso.estado)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
