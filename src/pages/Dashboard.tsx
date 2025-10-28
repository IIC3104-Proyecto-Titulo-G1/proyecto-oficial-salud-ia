import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, LogOut, Users, User as UserIcon, FileText, Search, Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/NotificationBell';

interface Caso {
  id: string;
  nombre_paciente: string;
  diagnostico_principal: string;
  estado: 'pendiente' | 'aceptado' | 'rechazado' | 'derivado';
  fecha_creacion: string;
  medico_tratante_id: string;
}

interface MedicoData {
  nombre: string;
  imagen: string | null;
}

type EstadoFiltro = 'todos' | 'pendiente' | 'aceptado' | 'rechazado' | 'derivado';

export default function Dashboard() {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const [medicosData, setMedicosData] = useState<Record<string, MedicoData>>({});
  const [openDateFilter, setOpenDateFilter] = useState(false);
  
  const itemsPerPage = 10;
  const { user, userRole, userRoleData, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const filtrosActivos = searchTerm.trim() !== '' || estadoFiltro !== 'todos' || fechaInicio !== '' || fechaFin !== '';

  // Establecer fecha de término por defecto a hoy
  useEffect(() => {
    if (userRole === 'medico_jefe' && !fechaFin) {
      const hoy = new Date().toISOString().split('T')[0];
      setFechaFin(hoy);
    }
  }, [userRole]);

  const loadCasos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('casos')
      .select('*')
      .order('fecha_creacion', { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los casos",
        variant: "destructive",
      });
    } else {
      setCasos(data || []);
      
      // Cargar información de médicos solo si es médico jefe
      console.log('🔍 userRole:', userRole);
      console.log('🔍 Cantidad de casos:', data?.length);
      
      if (userRole === 'medico_jefe' && data && data.length > 0) {
        const medicoIds = [...new Set(data.map(caso => caso.medico_tratante_id))];
        console.log('🔍 IDs de médicos únicos:', medicoIds);
        
        const { data: medicosInfo, error: medicosError } = await supabase
          .from('user_roles')
          .select('user_id, nombre, imagen')
          .in('user_id', medicoIds);
        
        console.log('🔍 Información de médicos:', medicosInfo);
        console.log('🔍 Error al cargar médicos:', medicosError);
        
        if (!medicosError && medicosInfo) {
          const medicosMap: Record<string, MedicoData> = {};
          medicosInfo.forEach(medico => {
            medicosMap[medico.user_id] = {
              nombre: medico.nombre,
              imagen: medico.imagen,
            };
          });
          console.log('🔍 Mapa de médicos:', medicosMap);
          setMedicosData(medicosMap);
        }
      }
    }

    setLoading(false);
  }, [toast, userRole]);

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

  // Efecto separado para manejar el filtrado desde notificaciones
  useEffect(() => {
    const casoId = searchParams.get('caso');
    if (casoId && casos.length > 0) {
      const caso = casos.find(c => c.id === casoId);
      if (caso) {
        setSearchTerm(caso.nombre_paciente);
      }
      // Limpiar el parámetro de la URL
      setSearchParams({});
    }
  }, [searchParams, casos.length]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleCardClick = (estado: EstadoFiltro) => {
    setEstadoFiltro(estado);
    setCurrentPage(1); // Resetear a la primera página
    // Scroll suave hacia la lista de casos
    setTimeout(() => {
      const casosSection = document.getElementById('casos-section');
      if (casosSection) {
        casosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Resetear a la primera página cuando cambien los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, estadoFiltro, fechaInicio, fechaFin]);

  const filteredCasos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return casos.filter((caso) => {
      const matchesEstado = estadoFiltro === 'todos' || caso.estado === estadoFiltro;

      if (!matchesEstado) {
        return false;
      }

      // Filtro por fecha
      const casoFecha = new Date(caso.fecha_creacion);
      if (fechaInicio) {
        const fechaInicioDate = new Date(fechaInicio);
        if (casoFecha < fechaInicioDate) {
          return false;
        }
      }
      if (fechaFin) {
        const fechaFinDate = new Date(fechaFin);
        fechaFinDate.setHours(23, 59, 59, 999); // Incluir todo el día
        if (casoFecha > fechaFinDate) {
          return false;
        }
      }

      if (!normalizedSearch) {
        return true;
      }

      const hayCoincidencia = `${caso.nombre_paciente} ${caso.diagnostico_principal}`
        .toLowerCase()
        .includes(normalizedSearch);

      return hayCoincidencia;
    });
  }, [casos, estadoFiltro, searchTerm, fechaInicio, fechaFin]);

  // Calcular casos paginados
  const totalPages = Math.ceil(filteredCasos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCasos = filteredCasos.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    // Scroll suave hacia la lista de casos
    setTimeout(() => {
      const casosSection = document.getElementById('casos-section');
      if (casosSection) {
        casosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

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
      case 'derivado':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getEstadoBadgeClassName = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return 'bg-muted/50 text-muted-foreground border-border/50';
      default:
        return '';
    }
  };

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'aceptado':
        return 'Ley de Urgencia Aceptada';
      case 'rechazado':
        return 'Ley de Urgencia No Aceptada';
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
      <header className="sticky top-0 z-50 border-b border-crm/20 bg-gradient-to-r from-crm/15 via-white to-crm/15 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div>
                  <img 
                    src="/logo1.jpeg" 
                    alt="SaludIA Logo" 
                    className="w-14 h-14 object-contain"
                  />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-crm">SaludIA</h1>
                <p className="text-sm font-medium text-crm/80">
                  {userRoleData?.nombre} • {userRole === 'medico_jefe' ? 'Médico Jefe' : userRole === 'medico' ? 'Médico' : 'Administrador'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <button onClick={() => navigate('/perfil')} className="cursor-pointer hover:opacity-80 transition-opacity">
                <Avatar className="h-10 w-10 border-2 border-crm/20">
                  <AvatarImage src={userRoleData?.imagen || ''} alt={userRoleData?.nombre} />
                  <AvatarFallback className="bg-crm/10 text-crm">
                    {userRoleData?.nombre?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || <UserIcon className="h-5 w-5" />}
                  </AvatarFallback>
                </Avatar>
              </button>
              {userRole === 'admin' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="gap-2 border-crm/40 text-crm hover:bg-crm/10 hover:text-crm"
                >
                  <Users className="h-4 w-4" />
                  Usuarios
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/perfil')}
                className="gap-2 border-crm/40 text-crm hover:bg-crm/10 hover:text-crm"
              >
                <UserIcon className="h-4 w-4" />
                Mi Perfil
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="gap-2 border-crm/40 text-crm hover:bg-crm/10 hover:text-crm"
              >
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          {/* Total Casos */}
          <Card 
            className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/5 hover:shadow-xl transition-all duration-300 group cursor-pointer hover:scale-105"
            onClick={() => handleCardClick('todos')}
          >
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


          {/* Pendientes */}
          <Card 
            className="relative overflow-hidden border-warning/20 bg-gradient-to-br from-card to-warning/5 hover:shadow-xl transition-all duration-300 group cursor-pointer hover:scale-105"
            onClick={() => handleCardClick('pendiente')}
          >
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
          <Card 
            className="relative overflow-hidden border-secondary/20 bg-gradient-to-br from-card to-secondary/5 hover:shadow-xl transition-all duration-300 group cursor-pointer hover:scale-105"
            onClick={() => handleCardClick('derivado')}
          >
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



          {/* Ley No Aplicada */}
          <Card 
            className="relative overflow-hidden border-destructive/20 bg-gradient-to-br from-card to-destructive/5 hover:shadow-xl transition-all duration-300 group cursor-pointer hover:scale-105"
            onClick={() => handleCardClick('rechazado')}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/10 rounded-full blur-3xl group-hover:bg-destructive/20 transition-all"></div>
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-destructive/10 ring-1 ring-destructive/20">
                  <svg className="w-6 h-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <Badge variant="outline" className="text-xs font-semibold border-destructive/30 text-destructive">
                  No Aplicada
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Ley No Aplicada</p>
                <p className="text-4xl font-bold text-foreground">
                  {casosPorEstado.rechazado}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Ley Aplicada */}
          <Card 
            className="relative overflow-hidden border-success/20 bg-gradient-to-br from-card to-success/5 hover:shadow-xl transition-all duration-300 group cursor-pointer hover:scale-105"
            onClick={() => handleCardClick('aceptado')}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-success/10 rounded-full blur-3xl group-hover:bg-success/20 transition-all"></div>
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-success/10 ring-1 ring-success/20">
                  <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <Badge variant="outline" className="text-xs font-semibold border-success/30 text-success">
                  Aplicada
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Ley Aplicada</p>
                <p className="text-4xl font-bold text-foreground">
                  {casosPorEstado.aceptado}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Header de lista mejorado */}
        <div id="casos-section" className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-2 text-foreground">Casos Recientes</h2>
            <p className="text-muted-foreground">
              Gestiona y evalúa casos clínicos bajo la Ley de Urgencia
            </p>
          </div>
          {(userRole === 'medico' || userRole === 'medico_jefe') && (
            <Button
              onClick={() => navigate('/caso/nuevo')}
              size="lg"
              className="gap-2 bg-crm hover:bg-crm/90 text-white shadow-lg shadow-crm/30 hover:shadow-xl hover:shadow-crm/40 transition-all"
            >
              <Plus className="w-5 h-5" />
              Nuevo Caso
            </Button>
          )}
        </div>

        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="relative sm:max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-crm" />
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
                <SelectItem value="aceptado">Aplica ley</SelectItem>
                <SelectItem value="rechazado">No aplica ley</SelectItem>
                <SelectItem value="derivado">Derivado</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtros de fecha solo para médicos jefe */}
            {userRole === 'medico_jefe' && (
              <Popover open={openDateFilter} onOpenChange={setOpenDateFilter}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    Filtrar por fecha
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto" align="start">
                  <div className="space-y-4 py-2">
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-center block">Fecha inicio</label>
                      <Input
                        type="date"
                        value={fechaInicio}
                        onChange={(event) => setFechaInicio(event.target.value)}
                        className="w-[200px] text-center"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-center block">Fecha término</label>
                      <Input
                        type="date"
                        value={fechaFin}
                        onChange={(event) => setFechaFin(event.target.value)}
                        className="w-[200px] text-center"
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFechaInicio('');
                          setFechaFin('');
                        }}
                        disabled={!fechaInicio && !fechaFin}
                      >
                        Limpiar
                      </Button>
                      <Button size="sm" onClick={() => setOpenDateFilter(false)}>
                        Aplicar
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-crm">
              Mostrando <span className="font-semibold text-crm/80">{filteredCasos.length}</span> de {casos.length} casos
              {filteredCasos.length > 0 && (
                <span className="text-muted-foreground">
                  {' '}(Página {currentPage} de {totalPages})
                </span>
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setEstadoFiltro('todos');
                setFechaInicio('');
                setFechaFin('');
                setCurrentPage(1);
              }}
              disabled={!filtrosActivos}
              className="border-crm/40 text-crm hover:bg-crm/10 hover:text-crm disabled:text-muted-foreground disabled:border-muted"
            >
              Limpiar filtros
            </Button>
          </div>
        </div>

        {/* Lista de casos mejorada */}
        {casos.length === 0 ? (
          <Card className="border-dashed border-2 border-crm/30 bg-muted/20">
            <CardContent className="p-16 text-center">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-crm/10 to-crm/20 rounded-2xl flex items-center justify-center ring-1 ring-crm/30">
                <FileText className="w-12 h-12 text-crm" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground">No hay casos registrados</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Comienza creando un nuevo caso clínico para evaluar bajo la Ley de Urgencia
              </p>
              {(userRole === 'medico' || userRole === 'medico_jefe') && (
                <Button
                  onClick={() => navigate('/caso/nuevo')}
                  size="lg"
                  className="gap-2 bg-crm hover:bg-crm/90 text-white"
                >
                  <Plus className="w-5 h-5" />
                  Crear Primer Caso
                </Button>
              )}
            </CardContent>
          </Card>
        ) : filteredCasos.length === 0 ? (
          <Card className="border-dashed border-2 border-crm/30 bg-muted/20">
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
                className="border-crm/40 text-crm hover:bg-crm/10 hover:text-crm"
              >
                Limpiar filtros
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-5">
              {paginatedCasos.map((caso) => (
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
                    <div className="flex flex-col items-end gap-3">
                      <Badge 
                        variant={getEstadoBadgeVariant(caso.estado)}
                        className={getEstadoBadgeClassName(caso.estado)}
                      >
                        {getEstadoLabel(caso.estado)}
                      </Badge>
                      
                      {/* Mostrar información del médico solo para médicos jefe */}
                      {userRole === 'medico_jefe' && medicosData[caso.medico_tratante_id] && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Avatar className="h-6 w-6 border border-border">
                            <AvatarImage 
                              src={medicosData[caso.medico_tratante_id].imagen || ''} 
                              alt={medicosData[caso.medico_tratante_id].nombre} 
                            />
                            <AvatarFallback className="bg-muted text-[10px]">
                              {medicosData[caso.medico_tratante_id].nombre
                                ?.split(' ')
                                .map(n => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2) || '??'}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            Ingresado por:{' '}
                            <span className="font-medium text-foreground">
                              {caso.medico_tratante_id === user?.id 
                                ? 'usted' 
                                : medicosData[caso.medico_tratante_id].nombre}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              ))}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="border-crm/40 text-crm hover:bg-crm/10 hover:text-crm disabled:text-muted-foreground disabled:border-muted"
                >
                  Anterior
                </Button>
                
                <div className="flex items-center gap-1">
                  {(() => {
                    const pages: (number | string)[] = [];
                    
                    // Si hay 7 o menos páginas, mostrar todas
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      // Siempre mostrar la primera página
                      pages.push(1);
                      
                      // Si la página actual está lejos del inicio
                      if (currentPage > 3) {
                        pages.push('...');
                      }
                      
                      // Calcular el rango de páginas a mostrar
                      let startPage = Math.max(2, currentPage - 1);
                      let endPage = Math.min(totalPages - 1, currentPage + 1);
                      
                      // Ajustar el rango si estamos cerca de los bordes
                      if (currentPage <= 3) {
                        endPage = 4;
                      }
                      if (currentPage >= totalPages - 2) {
                        startPage = totalPages - 3;
                      }
                      
                      // Agregar páginas del rango (sin duplicados)
                      for (let i = startPage; i <= endPage; i++) {
                        if (i !== 1 && i !== totalPages) {
                          pages.push(i);
                        }
                      }
                      
                      // Si la página actual está lejos del final
                      if (currentPage < totalPages - 2) {
                        pages.push('...');
                      }
                      
                      // Siempre mostrar la última página
                      pages.push(totalPages);
                    }
                    
                    return pages.map((page, index) => {
                      if (page === '...') {
                        return (
                          <span key={`ellipsis-${index}`} className="text-muted-foreground px-2">
                            ...
                          </span>
                        );
                      }
                      
                      const pageNum = page as number;
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(pageNum)}
                          className={currentPage === pageNum ? "bg-crm hover:bg-crm/90 text-white" : "border-crm/40 text-crm hover:bg-crm/10"}
                        >
                          {pageNum}
                        </Button>
                      );
                    });
                  })()}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="border-crm/40 text-crm hover:bg-crm/10 hover:text-crm disabled:text-muted-foreground disabled:border-muted"
                >
                  Siguiente
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
