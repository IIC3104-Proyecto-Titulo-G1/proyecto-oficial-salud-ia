import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, LogOut, Users, User as UserIcon, FileText, Search, Calendar, Trash2 } from 'lucide-react';
import { getDoctorPrefix, consoleLogDebugger } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/NotificationBell';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AseguradorasUpload } from '@/components/AseguradorasUpload';

interface Caso {
  id: string;
  nombre_paciente: string;
  diagnostico_principal: string;
  estado: 'pendiente' | 'aceptado' | 'rechazado' | 'derivado';
  fecha_creacion: string;
  medico_tratante_id: string;
  episodio?: string;
  prevision?: string;
  estado_resolucion_aseguradora?: 'pendiente' | 'pendiente_envio' | 'aceptada' | 'rechazada';
}

interface MedicoData {
  nombre: string;
  imagen: string | null;
  genero?: string | null;
}

type RangoMetricas = 'todos' | '30' | '7' | '1' | 'custom';

type EstadoFiltro = 'todos' | 'pendiente' | 'aceptado' | 'rechazado' | 'derivado';

export default function Dashboard() {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [rangoMetricas, setRangoMetricas] = useState<RangoMetricas>('todos');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtroMedico, setFiltroMedico] = useState('todos');
  const [filtroCasoId, setFiltroCasoId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const [medicosData, setMedicosData] = useState<Record<string, MedicoData>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingCasoId, setDeletingCasoId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const filtroDesdeNotificacion = useRef(false);
  const [showEstadoAseguradoraModal, setShowEstadoAseguradoraModal] = useState(false);
  const [casoEditandoEstado, setCasoEditandoEstado] = useState<Caso | null>(null);
  const [actualizandoEstado, setActualizandoEstado] = useState(false);
  
  const itemsPerPage = 10;
  const { user, userRole, userRoleData, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const filtrosActivos = searchTerm.trim() !== '' || estadoFiltro !== 'todos' || fechaInicio !== '' || fechaFin !== '' || (filtroMedico !== 'todos' && filtroMedico !== '') || filtroCasoId !== null;

  // Establecer fecha de término por defecto a hoy para todos los médicos
  useEffect(() => {
    if ((userRole === 'medico' || userRole === 'medico_jefe') && !fechaFin && rangoMetricas !== 'todos') {
      const hoy = new Date().toISOString().split('T')[0];
      setFechaFin(hoy);
    }
  }, [userRole, fechaFin, rangoMetricas]);

  const loadCasos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('casos')
      .select('*, estado_resolucion_aseguradora, prevision')
      .order('fecha_creacion', { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los casos",
        variant: "destructive",
      });
    } else {
      setCasos((data || []) as Caso[]);
      
      // Log para verificar que los campos se carguen correctamente
      if (data && data.length > 0) {
        const casosConResolucion = data.filter(c => (c as any).estado_resolucion_aseguradora);
        consoleLogDebugger('🔍 Casos con estado_resolucion_aseguradora:', casosConResolucion.map(c => ({
          episodio: (c as any).episodio,
          estado: c.estado,
          estado_resolucion_aseguradora: (c as any).estado_resolucion_aseguradora,
          prevision: (c as any).prevision
        })));
        
        // Log específico para casos que deberían mostrar el badge
        const casosAceptados = data.filter(c => c.estado === 'aceptado' && (c as any).prevision);
        consoleLogDebugger('🔍 Casos aceptados con prevision:', casosAceptados.map(c => ({
          episodio: (c as any).episodio,
          estado: c.estado,
          estado_resolucion_aseguradora: (c as any).estado_resolucion_aseguradora,
          prevision: (c as any).prevision,
          tieneEstadoResolucion: !!(c as any).estado_resolucion_aseguradora
        })));
      }
      
      // Cargar información de médicos solo si es médico jefe
      consoleLogDebugger('🔍 userRole:', userRole);
      consoleLogDebugger('🔍 Cantidad de casos:', data?.length);
      
      if (userRole === 'medico_jefe' && data && data.length > 0) {
        const medicoIds = [...new Set(data.map(caso => caso.medico_tratante_id))];
        consoleLogDebugger('🔍 IDs de médicos únicos:', medicoIds);
        
        const { data: medicosInfo, error: medicosError } = await supabase
          .from('user_roles')
          .select('user_id, nombre, imagen, genero')
          .in('user_id', medicoIds);
        
        consoleLogDebugger('🔍 Información de médicos:', medicosInfo);
        consoleLogDebugger('🔍 Error al cargar médicos:', medicosError);
        
        if (!medicosError && medicosInfo) {
          const medicosMap: Record<string, MedicoData> = {};
          medicosInfo.forEach(medico => {
            medicosMap[medico.user_id] = {
              nombre: medico.nombre,
              imagen: medico.imagen,
              genero: medico.genero,
            };
          });
          consoleLogDebugger('🔍 Mapa de médicos:', medicosMap);
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
     
  }, [user, userRole]);

  // Efecto separado para manejar el filtrado desde notificaciones
  useEffect(() => {
    const casoId = searchParams.get('caso');
    if (casoId && casos.length > 0) {
      const caso = casos.find(c => c.id === casoId);
      if (caso) {
        // Marcar que el filtro viene de una notificación
        filtroDesdeNotificacion.current = true;
        // Filtrar por ID del caso en lugar de nombre
        setFiltroCasoId(casoId);
        // También establecer el nombre en el searchTerm para que se muestre en el input
        setSearchTerm(caso.nombre_paciente);
        // Limpiar el parámetro de la URL después de procesarlo
      setSearchParams({});
        // Resetear el flag después de un pequeño delay para permitir que los otros efectos se ejecuten
        setTimeout(() => {
          filtroDesdeNotificacion.current = false;
        }, 100);
      }
    }
  }, [searchParams, casos.length, setSearchParams]);

  // Limpiar el filtro por ID cuando se modifique cualquier otro filtro manualmente
  useEffect(() => {
    // Solo limpiar si el cambio NO viene de una notificación
    if (filtroCasoId && !filtroDesdeNotificacion.current) {
      setFiltroCasoId(null);
    }
     
  }, [searchTerm, estadoFiltro, fechaInicio, fechaFin, filtroMedico]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleDeleteCaso = (casoId: string) => {
    // Evitar abrir el modal si ya está abierto o hay una eliminación en progreso
    if (showDeleteModal || isDeleting) return;
    
    setDeletingCasoId(casoId);
    setShowDeleteModal(true);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleCambiarEstadoAseguradora = (caso: Caso) => {
    setCasoEditandoEstado(caso);
    setShowEstadoAseguradoraModal(true);
  };

  const handleConfirmarCambioEstadoAseguradora = async (nuevoEstado: 'pendiente' | 'pendiente_envio' | 'aceptada' | 'rechazada') => {
    if (!casoEditandoEstado || actualizandoEstado) return;

    setActualizandoEstado(true);
    try {
      const { error } = await supabase
        .from('casos')
        .update({ estado_resolucion_aseguradora: nuevoEstado })
        .eq('id', casoEditandoEstado.id);

      if (error) throw error;

      // Actualizar el estado local
      setCasos(prevCasos =>
        prevCasos.map(caso =>
          caso.id === casoEditandoEstado.id
            ? { ...caso, estado_resolucion_aseguradora: nuevoEstado } as Caso
            : caso
        )
      );

      toast({
        title: 'Estado actualizado',
        description: `El estado de resolución del asegurador ha sido actualizado a ${nuevoEstado === 'aceptada' ? 'Aceptada' : nuevoEstado === 'rechazada' ? 'Rechazada' : 'Pendiente'}`,
      });

      setShowEstadoAseguradoraModal(false);
      setCasoEditandoEstado(null);
    } catch (error: any) {
      toast({
        title: 'Error al actualizar estado',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActualizandoEstado(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCasoId || !user?.email || isDeleting) return;
    
    setDeleteError('');
    setIsDeleting(true);

    try {
      // Verificar la contraseña del usuario
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });

      if (signInError) {
        setDeleteError('Contraseña incorrecta');
        setIsDeleting(false);
        return;
      }

      // Eliminar el caso y todos sus datos relacionados
      // Primero eliminar sugerencias IA
      const { error: sugerenciaError } = await supabase
        .from('sugerencia_ia')
        .delete()
        .eq('caso_id', deletingCasoId);

      if (sugerenciaError) throw sugerenciaError;

      // Eliminar comunicaciones
      const { error: comunicacionesError } = await supabase
        .from('comunicaciones_paciente')
        .delete()
        .eq('caso_id', deletingCasoId);

      if (comunicacionesError) throw comunicacionesError;

      // Eliminar resolución
      const { error: resolucionError } = await supabase
        .from('resolucion_caso')
        .delete()
        .eq('caso_id', deletingCasoId);

      if (resolucionError) throw resolucionError;

      // Finalmente eliminar el caso
      const { error: casoError } = await supabase
        .from('casos')
        .delete()
        .eq('id', deletingCasoId);

      if (casoError) throw casoError;

      // Guardar referencia al caso eliminado antes de actualizar el estado
      const casoEliminado = casos.find((c) => c.id === deletingCasoId);

      // Eliminar el caso del estado local sin recargar la página
      setCasos((prevCasos) => prevCasos.filter((caso) => caso.id !== deletingCasoId));
      
      // Si es médico jefe, limpiar datos del médico si ya no tiene más casos
      if (userRole === 'medico_jefe' && casoEliminado) {
        // Verificar si hay más casos del mismo médico tratante después de la eliminación
        const quedanCasosDelMedico = casos.some(
          (c) => c.id !== deletingCasoId && c.medico_tratante_id === casoEliminado.medico_tratante_id
        );
        if (!quedanCasosDelMedico && medicosData[casoEliminado.medico_tratante_id]) {
          setMedicosData((prev) => {
            const nuevo = { ...prev };
            delete nuevo[casoEliminado.medico_tratante_id];
            return nuevo;
          });
        }
      }

      // Cerrar modal y limpiar estado
      setShowDeleteModal(false);
      setDeletingCasoId(null);
      setDeletePassword('');
      setDeleteError('');

      toast({
        title: 'Caso eliminado',
        description: 'El caso ha sido eliminado exitosamente',
      });
    } catch (error: any) {
      toast({
        title: 'Error al eliminar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
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
  }, [searchTerm, estadoFiltro, fechaInicio, fechaFin, filtroMedico]);

  const filteredCasos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return casos.filter((caso) => {
      // Si hay un filtro por ID de caso, solo mostrar ese caso
      if (filtroCasoId) {
        return caso.id === filtroCasoId;
      }

      const matchesEstado = estadoFiltro === 'todos' || caso.estado === estadoFiltro;

      if (!matchesEstado) {
        return false;
      }

      // Filtro por fecha
      // Agregar 'Z' para forzar que sea interpretado como UTC
      const casoFecha = new Date(caso.fecha_creacion + 'Z');
      if (fechaInicio) {
        const fechaInicioDate = new Date(fechaInicio + 'T00:00:00Z');
        if (casoFecha < fechaInicioDate) {
          return false;
        }
      }
      if (fechaFin) {
        const fechaFinDate = new Date(fechaFin + 'T23:59:59.999Z');
        if (casoFecha > fechaFinDate) {
          return false;
        }
      }

      // Filtro por médico
      if (filtroMedico !== 'todos' && caso.medico_tratante_id !== filtroMedico) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const hayCoincidencia = [
        caso.nombre_paciente,
        caso.diagnostico_principal,
        caso.episodio || ''
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);

      return hayCoincidencia;
    });
  }, [casos, estadoFiltro, searchTerm, fechaInicio, fechaFin, filtroMedico, filtroCasoId]);

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

  const handleRangoMetricasChange = (value: RangoMetricas) => {
    setRangoMetricas(value);

    if (value === 'custom') {
      return;
    }

    if (value === 'todos') {
      setFechaInicio('');
      setFechaFin('');
      return;
    }

    const dias = value === '30' ? 30 : value === '7' ? 7 : 1;
    const hoy = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - (dias - 1));

    setFechaInicio(inicio.toISOString().split('T')[0]);
    setFechaFin(hoy.toISOString().split('T')[0]);
  };

  const rangoFechasMetricas = useMemo(() => {
    if (rangoMetricas === 'todos') {
      return { inicio: null as Date | null, fin: null as Date | null, dias: null as number | null };
    }

    if (rangoMetricas === 'custom') {
      return {
        inicio: fechaInicio ? new Date(fechaInicio + 'T00:00:00Z') : null,
        fin: fechaFin ? new Date(fechaFin + 'T23:59:59.999Z') : null,
        dias: null as number | null,
      };
    }

    const dias = rangoMetricas === '30' ? 30 : rangoMetricas === '7' ? 7 : 1;
    const fin = new Date();
    fin.setHours(23, 59, 59, 999);
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - (dias - 1));
    inicio.setHours(0, 0, 0, 0);

    return { inicio, fin, dias };
  }, [rangoMetricas, fechaInicio, fechaFin]);

  const casosParaMetricas = useMemo(() => {
    const { inicio, fin } = rangoFechasMetricas;

    if (!inicio && !fin) {
      return casos;
    }

    return casos.filter((caso) => {
      const fechaCaso = new Date(caso.fecha_creacion + 'Z');
      if (Number.isNaN(fechaCaso.getTime())) {
        return false;
      }

      if (inicio && fechaCaso < inicio) return false;
      if (fin && fechaCaso > fin) return false;
      return true;
    });
  }, [casos, rangoFechasMetricas]);

  const casosPorEstado = useMemo(() => {
    return casosParaMetricas.reduce(
      (acc, caso) => {
        acc[caso.estado] += 1;
        return acc;
      },
      { aceptado: 0, rechazado: 0, pendiente: 0, derivado: 0 }
    );
  }, [casosParaMetricas]);

  const casosPreviosMetricas = useMemo(() => {
    if (!rangoFechasMetricas.dias || rangoMetricas === 'custom' || rangoMetricas === 'todos') {
      return [];
    }

    const { inicio } = rangoFechasMetricas;
    if (!inicio) return [];

    const dias = rangoFechasMetricas.dias;
    const inicioPrevio = new Date(inicio);
    inicioPrevio.setDate(inicioPrevio.getDate() - dias);
    inicioPrevio.setHours(0, 0, 0, 0);
    const finPrevio = new Date(inicio);
    finPrevio.setMilliseconds(finPrevio.getMilliseconds() - 1);

    return casos.filter((caso) => {
      const fechaCaso = new Date(caso.fecha_creacion + 'Z');
      if (Number.isNaN(fechaCaso.getTime())) {
        return false;
      }

      return fechaCaso >= inicioPrevio && fechaCaso <= finPrevio;
    });
  }, [casos, rangoFechasMetricas, rangoMetricas]);

  const casosPorEstadoPrevio = useMemo(() => {
    return casosPreviosMetricas.reduce(
      (acc, caso) => {
        acc[caso.estado] += 1;
        return acc;
      },
      { aceptado: 0, rechazado: 0, pendiente: 0, derivado: 0 }
    );
  }, [casosPreviosMetricas]);

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

  const getDeltaInfo = (actual: number, previo: number) => {
    if (previo === 0) {
      if (actual === 0) {
        return { label: '0% vs período anterior', className: 'text-muted-foreground' };
      }
      return { label: 'Sin data', className: 'text-muted-foreground' };
    }

    const delta = ((actual - previo) / previo) * 100;
    const sign = delta > 0 ? '+' : '';
    const className = delta > 0 ? 'text-success' : delta < 0 ? 'text-destructive' : 'text-muted-foreground';
    return { label: `${sign}${delta.toFixed(1)}% vs período anterior`, className };
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={rangoMetricas} onValueChange={(value) => handleRangoMetricasChange(value as RangoMetricas)}>
              <SelectTrigger className="sm:w-[220px]">
                <Calendar className="h-4 w-4" />
                <SelectValue placeholder="Rango de tiempo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="1">Último día</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {rangoMetricas === 'custom' && (
              <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Fecha inicio</Label>
                  <Input
                    type="date"
                    value={fechaInicio}
                    onChange={(event) => {
                      setFechaInicio(event.target.value);
                      setRangoMetricas('custom');
                    }}
                    className="w-[170px] text-center"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Fecha término</Label>
                  <Input
                    type="date"
                    value={fechaFin}
                    onChange={(event) => {
                      setFechaFin(event.target.value);
                      setRangoMetricas('custom');
                    }}
                    className="w-[170px] text-center"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFechaInicio('');
                      setFechaFin('');
                      handleRangoMetricasChange('todos');
                    }}
                    disabled={!fechaInicio && !fechaFin}
                  >
                    Limpiar
                  </Button>
                  <Button size="sm" onClick={() => setCurrentPage(1)}>
                    Aplicar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

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
                <p className="text-4xl font-bold text-foreground">{casosParaMetricas.length}</p>
                {(rangoMetricas === '7' || rangoMetricas === '30') && (
                  <div className={`text-[11px] font-medium text-right mt-1 ${getDeltaInfo(casosParaMetricas.length, casosPreviosMetricas.length).className}`}>
                    {getDeltaInfo(casosParaMetricas.length, casosPreviosMetricas.length).label}
                  </div>
                )}
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
                {(rangoMetricas === '7' || rangoMetricas === '30') && (
                  <div className={`text-[11px] font-medium text-right mt-1 ${getDeltaInfo(casosPorEstado.pendiente, casosPorEstadoPrevio.pendiente).className}`}>
                    {getDeltaInfo(casosPorEstado.pendiente, casosPorEstadoPrevio.pendiente).label}
                  </div>
                )}
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
                {(rangoMetricas === '7' || rangoMetricas === '30') && (
                  <div className={`text-[11px] font-medium text-right mt-1 ${getDeltaInfo(casosPorEstado.derivado, casosPorEstadoPrevio.derivado).className}`}>
                    {getDeltaInfo(casosPorEstado.derivado, casosPorEstadoPrevio.derivado).label}
                  </div>
                )}
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
                {(rangoMetricas === '7' || rangoMetricas === '30') && (
                  <div className={`text-[11px] font-medium text-right mt-1 ${getDeltaInfo(casosPorEstado.rechazado, casosPorEstadoPrevio.rechazado).className}`}>
                    {getDeltaInfo(casosPorEstado.rechazado, casosPorEstadoPrevio.rechazado).label}
                  </div>
                )}
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
                {(rangoMetricas === '7' || rangoMetricas === '30') && (
                  <div className={`text-[11px] font-medium text-right mt-1 ${getDeltaInfo(casosPorEstado.aceptado, casosPorEstadoPrevio.aceptado).className}`}>
                    {getDeltaInfo(casosPorEstado.aceptado, casosPorEstadoPrevio.aceptado).label}
                  </div>
                )}
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
          <div className="flex flex-col sm:flex-row gap-3">
            {userRole === 'medico_jefe' && (
              <AseguradorasUpload onSuccess={loadCasos} />
            )}
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
        </div>

        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="relative sm:max-w-[300px] w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-crm" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Paciente, episodio o diagnóstico"
                className="pl-10"
              />
            </div>
            <Select value={estadoFiltro} onValueChange={(value) => setEstadoFiltro(value as EstadoFiltro)}>
              <SelectTrigger className="sm:w-[200px]">
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

            {/* Filtro por médico solo para médicos jefe */}
            {userRole === 'medico_jefe' && Object.keys(medicosData).length > 0 && (
              <Select value={filtroMedico || 'todos'} onValueChange={setFiltroMedico}>
                <SelectTrigger className="sm:w-[200px]">
                  <SelectValue placeholder="Filtrar por médico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los médicos</SelectItem>
                  {Object.entries(medicosData).map(([medicoId, medicoInfo]) => (
                    <SelectItem key={medicoId} value={medicoId}>
                      {medicoInfo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                handleRangoMetricasChange('todos');
                setFiltroMedico('todos');
                setFiltroCasoId(null);
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
                  setFechaInicio('');
                  setFechaFin('');
                  setRangoMetricas('todos');
                  setFiltroMedico('todos');
                  setFiltroCasoId(null);
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
                          <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Paciente</p>
                          <h3 className="text-xl font-bold group-hover:text-primary transition-colors mb-2 truncate text-foreground">
                            {caso.nombre_paciente}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                            {caso.diagnostico_principal}
                          </p>
                        </div>
                      </div>
                      <div 
                        className="flex flex-wrap gap-3 mt-4 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg ring-1 ring-border/50">
                          Episodio: {caso.episodio || 'Sin número'}
                        </div>
                        <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg ring-1 ring-border/50">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(caso.fecha_creacion + 'Z').toLocaleDateString('es-CL', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            timeZone: 'America/Santiago'
                          })}
                        </div>
                        <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg ring-1 ring-border/50">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {new Date(caso.fecha_creacion + 'Z').toLocaleTimeString('es-CL', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'America/Santiago'
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <div className="flex items-center gap-2">
                        {/* Tags de resolución de aseguradora (solo para casos aceptados) */}
                        {caso.estado === 'aceptado' && (caso as any).prevision && (
                          <Badge 
                            variant={
                              (caso as any).estado_resolucion_aseguradora === 'aceptada' 
                                ? 'default' 
                                : (caso as any).estado_resolucion_aseguradora === 'rechazada' 
                                ? 'destructive' 
                                : 'secondary'
                            }
                            className={`text-xs font-medium ${
                              (caso as any).estado_resolucion_aseguradora === 'aceptada'
                                ? 'bg-success/10 text-success border-success/20 hover:bg-success/20'
                                : (caso as any).estado_resolucion_aseguradora === 'rechazada'
                                ? userRole === 'medico_jefe' 
                                  ? 'hover:border-destructive hover:border-2 hover:shadow-md transition-all' 
                                  : ''
                                : (caso as any).estado_resolucion_aseguradora === 'pendiente_envio'
                                ? userRole === 'medico_jefe'
                                  ? 'bg-amber/10 text-amber-700 border-amber-300 hover:bg-amber/20 hover:border-2 hover:shadow-md transition-all'
                                  : 'bg-amber/10 text-amber-700 border-amber-300'
                                : userRole === 'medico_jefe'
                                ? 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted/70 hover:border-2 hover:shadow-md transition-all'
                                : 'bg-muted/50 text-muted-foreground border-border/50'
                            } ${
                              userRole === 'medico_jefe' ? 'cursor-pointer transition-all' : ''
                            }`}
                            onClick={(e) => {
                              if (userRole === 'medico_jefe') {
                                e.stopPropagation();
                                handleCambiarEstadoAseguradora(caso);
                              }
                            }}
                          >
                            {(caso as any).estado_resolucion_aseguradora === 'aceptada' 
                              ? `Aceptado por ${(caso as any).prevision}` 
                              : (caso as any).estado_resolucion_aseguradora === 'rechazada' 
                              ? `Rechazado por ${(caso as any).prevision}`
                              : (caso as any).estado_resolucion_aseguradora === 'pendiente_envio'
                              ? `Pendiente envío a ${(caso as any).prevision}`
                              : `Pendiente resolución ${(caso as any).prevision}`}
                          </Badge>
                        )}
                        
                        <Badge 
                          variant={getEstadoBadgeVariant(caso.estado)}
                          className={`${getEstadoBadgeClassName(caso.estado)} cursor-default`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {getEstadoLabel(caso.estado)}
                        </Badge>
                        
                        {/* Botón de eliminar solo para médico jefe */}
                        {userRole === 'medico_jefe' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCaso(caso.id);
                            }}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
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
                                : `${getDoctorPrefix(medicosData[caso.medico_tratante_id].genero)} ${medicosData[caso.medico_tratante_id].nombre}`}
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

      {/* Modal de confirmación de eliminación */}
      <Dialog 
        open={showDeleteModal} 
        onOpenChange={(open) => {
          // Evitar cambios de estado durante una eliminación en progreso
          if (!open && !isDeleting) {
            setShowDeleteModal(false);
            setDeletePassword('');
            setDeleteError('');
            setDeletingCasoId(null);
          } else if (open && !isDeleting) {
            setShowDeleteModal(true);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              Esta acción es irreversible. Se eliminará el caso y todos sus datos relacionados (sugerencias, comunicaciones y resoluciones).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {deleteError && (
              <Alert variant="destructive">
                <AlertDescription>{deleteError}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="delete-password">Ingrese su contraseña para confirmar</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Contraseña"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deletePassword) {
                    handleConfirmDelete();
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setDeletePassword('');
                setDeleteError('');
                setDeletingCasoId(null);
              }}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={!deletePassword || isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar Caso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para cambiar estado de resolución del asegurador */}
      <Dialog 
        open={showEstadoAseguradoraModal} 
        onOpenChange={(open) => {
          if (!open && !actualizandoEstado) {
            setShowEstadoAseguradoraModal(false);
            setCasoEditandoEstado(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Estado de Resolución del Asegurador</DialogTitle>
            <DialogDescription>
              Seleccione el nuevo estado para la resolución de {casoEditandoEstado && (casoEditandoEstado as any).prevision ? (casoEditandoEstado as any).prevision : 'el asegurador'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {casoEditandoEstado && (
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Paciente</Label>
                  <p className="text-sm font-semibold text-foreground">{casoEditandoEstado.nombre_paciente}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Estado Actual</Label>
                  <div className="flex items-center gap-2">
                    <Badge
                            variant={
                              (casoEditandoEstado as any).estado_resolucion_aseguradora === 'aceptada'
                                ? 'default'
                                : (casoEditandoEstado as any).estado_resolucion_aseguradora === 'rechazada'
                                ? 'destructive'
                                : (casoEditandoEstado as any).estado_resolucion_aseguradora === 'pendiente_envio'
                                ? 'secondary'
                                : 'secondary'
                            }
                            className={`text-xs font-medium ${
                              (casoEditandoEstado as any).estado_resolucion_aseguradora === 'aceptada'
                                ? 'bg-success/10 text-success border-success/20'
                                : (casoEditandoEstado as any).estado_resolucion_aseguradora === 'rechazada'
                                ? ''
                                : (casoEditandoEstado as any).estado_resolucion_aseguradora === 'pendiente_envio'
                                ? 'bg-amber/10 text-amber-700 border-amber-300'
                                : 'bg-muted/50 text-muted-foreground border-border/50'
                            }`}
                    >
                      {(casoEditandoEstado as any).estado_resolucion_aseguradora === 'aceptada'
                        ? `Aceptado por ${(casoEditandoEstado as any).prevision}`
                        : (casoEditandoEstado as any).estado_resolucion_aseguradora === 'rechazada'
                        ? `Rechazado por ${(casoEditandoEstado as any).prevision}`
                        : (casoEditandoEstado as any).estado_resolucion_aseguradora === 'pendiente_envio'
                        ? `Pendiente envío a ${(casoEditandoEstado as any).prevision}`
                        : `Pendiente resolución ${(casoEditandoEstado as any).prevision}`}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="outline"
                onClick={() => handleConfirmarCambioEstadoAseguradora('pendiente_envio')}
                disabled={actualizandoEstado || (casoEditandoEstado as any)?.estado_resolucion_aseguradora === 'pendiente_envio'}
                className="justify-start h-auto py-4 bg-amber/10 text-amber-700 border-amber-300 hover:bg-amber/20 hover:text-amber-800 disabled:opacity-50"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="font-semibold text-base">Pendiente envío a {(casoEditandoEstado as any)?.prevision || 'Fonasa/Isapre'}</span>
                  <span className="text-xs text-amber-700/90">El caso está pendiente de ser enviado al asegurador</span>
                </div>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleConfirmarCambioEstadoAseguradora('pendiente')}
                disabled={actualizandoEstado || (casoEditandoEstado as any)?.estado_resolucion_aseguradora === 'pendiente'}
                className="justify-start h-auto py-4 bg-muted/80 text-foreground border-border hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="font-semibold text-base">Pendiente resolución {(casoEditandoEstado as any)?.prevision || 'Fonasa/Isapre'}</span>
                  <span className="text-xs text-muted-foreground">El caso está esperando resolución del asegurador</span>
                </div>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleConfirmarCambioEstadoAseguradora('aceptada')}
                disabled={actualizandoEstado || (casoEditandoEstado as any)?.estado_resolucion_aseguradora === 'aceptada'}
                className="justify-start h-auto py-4 bg-success/15 text-success border-success/30 hover:bg-success/25 hover:text-success disabled:opacity-50"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="font-semibold text-base">Aceptado por {(casoEditandoEstado as any)?.prevision || 'Fonasa/Isapre'}</span>
                  <span className="text-xs text-success/90">El asegurador ha aceptado el caso</span>
                </div>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleConfirmarCambioEstadoAseguradora('rechazada')}
                disabled={actualizandoEstado || (casoEditandoEstado as any)?.estado_resolucion_aseguradora === 'rechazada'}
                className="justify-start h-auto py-4 bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 hover:text-destructive disabled:opacity-50"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="font-semibold text-base">Rechazado por {(casoEditandoEstado as any)?.prevision || 'Fonasa/Isapre'}</span>
                  <span className="text-xs text-destructive/90">El asegurador ha rechazado el caso</span>
                </div>
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEstadoAseguradoraModal(false);
                setCasoEditandoEstado(null);
              }}
              disabled={actualizandoEstado}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
