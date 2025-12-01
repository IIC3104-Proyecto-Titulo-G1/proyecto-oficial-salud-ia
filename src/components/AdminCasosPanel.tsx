import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Calendar, User as UserIcon } from 'lucide-react';
import { getDoctorPrefix, consoleLogDebugger } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
  estado_resolucion_aseguradora?: 'pendiente' | 'aceptada' | 'rechazada';
}

interface MedicoData {
  nombre: string;
  imagen: string | null;
  genero?: string | null;
}

type RangoMetricas = 'todos' | '30' | '7' | '1' | 'custom';

type EstadoFiltro = 'todos' | 'pendiente' | 'aceptado' | 'rechazado' | 'derivado';

export function AdminCasosPanel() {
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
  const filtroDesdeNotificacion = useRef(false);
  const [showEstadoAseguradoraModal, setShowEstadoAseguradoraModal] = useState(false);
  const [casoEditandoEstado, setCasoEditandoEstado] = useState<Caso | null>(null);
  const [actualizandoEstado, setActualizandoEstado] = useState(false);
  
  const itemsPerPage = 10;
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const filtrosActivos = searchTerm.trim() !== '' || estadoFiltro !== 'todos' || fechaInicio !== '' || fechaFin !== '' || (filtroMedico !== 'todos' && filtroMedico !== '') || filtroCasoId !== null;

  // Establecer fecha de término por defecto a hoy
  useEffect(() => {
    if (!fechaFin && rangoMetricas !== 'todos') {
      const hoy = new Date().toISOString().split('T')[0];
      setFechaFin(hoy);
    }
  }, [fechaFin, rangoMetricas]);

  // Cargar casos (todos los casos para admin)
  const loadCasos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('casos')
        .select('*')
        .order('fecha_creacion', { ascending: false });

      if (error) {
        consoleLogDebugger('Error al cargar casos:', error);
        throw error;
      }

      consoleLogDebugger('Casos cargados:', data?.length || 0);

      if (data) {
        setCasos(data as Caso[]);

        // Cargar información de médicos
        const medicoIds = [...new Set(data.map(c => c.medico_tratante_id))];
        if (medicoIds.length > 0) {
          const { data: medicosData, error: medicosError } = await supabase
            .from('user_roles')
            .select('user_id, nombre, imagen, genero')
            .in('user_id', medicoIds);

          if (!medicosError && medicosData) {
            const medicosMap: Record<string, MedicoData> = {};
            medicosData.forEach((medico: any) => {
              medicosMap[medico.user_id] = {
                nombre: medico.nombre,
                imagen: medico.imagen,
                genero: medico.genero,
              };
            });
            setMedicosData(medicosMap);
          }
        }
      }
    } catch (error: any) {
      consoleLogDebugger('Error cargando casos:', error);
      consoleLogDebugger('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      toast({
        title: 'Error al cargar casos',
        description: error.message || 'No se pudieron cargar los casos. Verifica los permisos RLS.',
        variant: 'destructive',
      });
      // Establecer casos vacíos en caso de error
      setCasos([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCasos();
  }, [loadCasos]);

  // Manejar parámetro de URL para filtrar por caso específico
  useEffect(() => {
    const casoParam = searchParams.get('caso');
    if (casoParam) {
      setFiltroCasoId(casoParam);
      filtroDesdeNotificacion.current = true;
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Limpiar filtro de caso cuando cambien otros filtros
  useEffect(() => {
    if (filtroCasoId && !filtroDesdeNotificacion.current) {
      setFiltroCasoId(null);
    }
    filtroDesdeNotificacion.current = false;
  }, [searchTerm, estadoFiltro, fechaInicio, fechaFin, filtroMedico]);

  const handleCambiarEstadoAseguradora = (caso: Caso) => {
    setCasoEditandoEstado(caso);
    setShowEstadoAseguradoraModal(true);
  };

  const handleConfirmarCambioEstadoAseguradora = async (nuevoEstado: 'pendiente' | 'aceptada' | 'rechazada') => {
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

  const handleCardClick = (estado: EstadoFiltro) => {
    setEstadoFiltro(estado);
    setCurrentPage(1);
    setTimeout(() => {
      const casosSection = document.getElementById('casos-section');
      if (casosSection) {
        casosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, estadoFiltro, fechaInicio, fechaFin, filtroMedico]);

  const filteredCasos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return casos.filter((caso) => {
      if (filtroCasoId) {
        return caso.id === filtroCasoId;
      }

      const matchesEstado = estadoFiltro === 'todos' || caso.estado === estadoFiltro;

      if (!matchesEstado) {
        return false;
      }

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

  const totalPages = Math.ceil(filteredCasos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCasos = filteredCasos.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(page);
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
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando casos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
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

      {/* Header de lista */}
      <div id="casos-section" className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2 text-foreground">Casos Recientes</h2>
          <p className="text-muted-foreground">
            Ver y gestionar casos clínicos bajo la Ley de Urgencia
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <AseguradorasUpload onSuccess={loadCasos} />
        </div>
      </div>

      <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <div className="relative sm:max-w-[300px] w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
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

          {Object.keys(medicosData).length > 0 && (
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
          <p className="text-sm text-primary">
            Mostrando <span className="font-semibold text-primary/80">{filteredCasos.length}</span> de {casos.length} casos
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
            className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary disabled:text-muted-foreground disabled:border-muted"
          >
            Limpiar filtros
          </Button>
        </div>
      </div>

      {/* Lista de casos */}
      {casos.length === 0 ? (
        <Card className="border-dashed border-2 border-primary/30 bg-muted/20">
          <CardContent className="p-16 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary/10 to-primary/20 rounded-2xl flex items-center justify-center ring-1 ring-primary/30">
              <FileText className="w-12 h-12 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-foreground">No hay casos registrados</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Aún no se han registrado casos clínicos en el sistema
            </p>
          </CardContent>
        </Card>
      ) : filteredCasos.length === 0 ? (
        <Card className="border-dashed border-2 border-primary/30 bg-muted/20">
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
              className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
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
                        {caso.estado === 'aceptado' && (caso as any).prevision && (caso as any).estado_resolucion_aseguradora && (
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
                                ? 'hover:border-destructive hover:border-2 hover:shadow-md transition-all' 
                                : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted/70 hover:border-2 hover:shadow-md transition-all'
                            } cursor-pointer transition-all`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCambiarEstadoAseguradora(caso);
                            }}
                          >
                            {(caso as any).estado_resolucion_aseguradora === 'aceptada' 
                              ? `Aceptado por ${(caso as any).prevision}` 
                              : (caso as any).estado_resolucion_aseguradora === 'rechazada' 
                              ? `Rechazado por ${(caso as any).prevision}` 
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
                      </div>
                      
                      {/* Mostrar información del médico */}
                      {medicosData[caso.medico_tratante_id] && (
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
                className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary disabled:text-muted-foreground disabled:border-muted"
              >
                Anterior
              </Button>
              
              <div className="flex items-center gap-1">
                {(() => {
                  const pages: (number | string)[] = [];
                  
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i);
                    }
                  } else {
                    pages.push(1);
                    
                    if (currentPage > 3) {
                      pages.push('...');
                    }
                    
                    let startPage = Math.max(2, currentPage - 1);
                    let endPage = Math.min(totalPages - 1, currentPage + 1);
                    
                    if (currentPage <= 3) {
                      endPage = 4;
                    }
                    if (currentPage >= totalPages - 2) {
                      startPage = totalPages - 3;
                    }
                    
                    for (let i = startPage; i <= endPage; i++) {
                      if (i !== 1 && i !== totalPages) {
                        pages.push(i);
                      }
                    }
                    
                    if (currentPage < totalPages - 2) {
                      pages.push('...');
                    }
                    
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
                        className={currentPage === pageNum ? "bg-primary hover:bg-primary/90 text-white" : "border-primary/40 text-primary hover:bg-primary/10"}
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
                className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary disabled:text-muted-foreground disabled:border-muted"
              >
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}

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
                          : 'secondary'
                      }
                      className={`text-xs font-medium ${
                        (casoEditandoEstado as any).estado_resolucion_aseguradora === 'aceptada'
                          ? 'bg-success/10 text-success border-success/20'
                          : (casoEditandoEstado as any).estado_resolucion_aseguradora === 'rechazada'
                          ? ''
                          : 'bg-muted/50 text-muted-foreground border-border/50'
                      }`}
                    >
                      {(casoEditandoEstado as any).estado_resolucion_aseguradora === 'aceptada'
                        ? `Aceptado por ${(casoEditandoEstado as any).prevision}`
                        : (casoEditandoEstado as any).estado_resolucion_aseguradora === 'rechazada'
                        ? `Rechazado por ${(casoEditandoEstado as any).prevision}`
                        : `Pendiente resolución ${(casoEditandoEstado as any).prevision}`}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="outline"
                onClick={() => handleConfirmarCambioEstadoAseguradora('pendiente')}
                disabled={actualizandoEstado || (casoEditandoEstado as any)?.estado_resolucion_aseguradora === 'pendiente'}
                className="justify-start h-auto py-4 bg-muted/80 text-foreground border-border hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="font-semibold text-base">Pendiente resolución {(casoEditandoEstado as any)?.prevision || 'Fonasa/Isapre'}</span>
                  <span className="text-xs text-muted-foreground">El caso está esperando resolución</span>
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

