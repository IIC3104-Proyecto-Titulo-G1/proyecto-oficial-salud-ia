import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, TrendingUp, TrendingDown, Activity, CheckCircle, XCircle, Clock, ArrowRightLeft, Target, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { consoleLogDebugger } from '@/lib/utils';

type RangoMetricas = 'todos' | '30' | '7' | '1' | 'custom';

interface EstadisticasMedico {
  totalCasos: number;
  porcentajeAceptacionIA: number;
  totalDerivaciones: number;
  casosAceptadosAseguradora: number;
  casosRechazadosAseguradora: number;
  casosPendientesAseguradora: number;
  casosAceptadosPorMedico: number;
  tiempoPromedioResolucion: number; // en días
}

interface MedicoStatsDashboardProps {
  medicoId: string;
  medicoRol: 'medico' | 'medico_jefe';
}

export function MedicoStatsDashboard({ medicoId, medicoRol }: MedicoStatsDashboardProps) {
  const [rangoMetricas, setRangoMetricas] = useState<RangoMetricas>('todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState<EstadisticasMedico>({
    totalCasos: 0,
    porcentajeAceptacionIA: 0,
    totalDerivaciones: 0,
    casosAceptadosAseguradora: 0,
    casosRechazadosAseguradora: 0,
    casosPendientesAseguradora: 0,
    casosAceptadosPorMedico: 0,
    tiempoPromedioResolucion: 0,
  });

  // Calcular rango de fechas
  const getDateRange = useMemo(() => {
    const hoy = new Date();
    let inicio: Date | null = null;
    let fin: Date = new Date();
    fin.setHours(23, 59, 59, 999);

    switch (rangoMetricas) {
      case '1': {
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 1);
        fechaInicio.setHours(0, 0, 0, 0);
        inicio = fechaInicio;
        break;
      }
      case '7': {
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 7);
        fechaInicio.setHours(0, 0, 0, 0);
        inicio = fechaInicio;
        break;
      }
      case '30': {
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 30);
        fechaInicio.setHours(0, 0, 0, 0);
        inicio = fechaInicio;
        break;
      }
      case 'custom':
        if (fechaInicio && fechaFin) {
          inicio = new Date(fechaInicio);
          inicio.setHours(0, 0, 0, 0);
          fin = new Date(fechaFin);
          fin.setHours(23, 59, 59, 999);
        }
        break;
      case 'todos':
      default:
        inicio = null;
        break;
    }

    return { inicio, fin };
  }, [rangoMetricas, fechaInicio, fechaFin]);

  const loadEstadisticas = async () => {
    setLoading(true);
    try {
      const { inicio, fin } = getDateRange;

      // Construir query base para casos del médico
      // Para médico jefe: casos derivados a él (medico_jefe_id)
      // Para médico normal: casos creados por él (medico_tratante_id)
      let casosQuery = supabase
        .from('casos')
        .select('id, estado, fecha_creacion, fecha_actualizacion, estado_resolucion_aseguradora, medico_tratante_id, medico_jefe_id');
      
      if (medicoRol === 'medico_jefe') {
        casosQuery = casosQuery.eq('medico_jefe_id', medicoId);
      } else {
        casosQuery = casosQuery.eq('medico_tratante_id', medicoId);
      }

      // Aplicar filtro de fecha si existe
      if (inicio) {
        casosQuery = casosQuery.gte('fecha_creacion', inicio.toISOString());
        casosQuery = casosQuery.lte('fecha_creacion', fin.toISOString());
      }

      const { data: casos, error: casosError } = await casosQuery;

      if (casosError) throw casosError;

      const casosIds = casos?.map(c => c.id) || [];

      // Cargar sugerencias de IA para estos casos
      const { data: sugerencias, error: sugerenciasError } = await supabase
        .from('sugerencia_ia')
        .select('caso_id, sugerencia')
        .in('caso_id', casosIds.length > 0 ? casosIds : ['00000000-0000-0000-0000-000000000000'])
        .order('fecha_procesamiento', { ascending: false });

      if (sugerenciasError) throw sugerenciasError;

      // Cargar resoluciones de casos
      const { data: resoluciones, error: resolucionesError } = await supabase
        .from('resolucion_caso')
        .select('caso_id, decision_medico, fecha_decision_medico')
        .in('caso_id', casosIds.length > 0 ? casosIds : ['00000000-0000-0000-0000-000000000000']);

      if (resolucionesError) throw resolucionesError;

      // Crear mapas para acceso rápido
      const sugerenciasMap = new Map(sugerencias?.map(s => [s.caso_id, s]) || []);
      const resolucionesMap = new Map(resoluciones?.map(r => [r.caso_id, r]) || []);

      // Calcular métricas
      const totalCasos = casos?.length || 0;
      
      // Casos aceptados por el médico (estado = 'aceptado')
      const casosAceptadosPorMedico = casos?.filter(c => c.estado === 'aceptado').length || 0;

      // Derivaciones
      // Para médico jefe: casos que fueron derivados a él (estado = 'derivado' y medico_jefe_id = medicoId)
      // Para médico normal: casos que él derivó (estado = 'derivado' y medico_tratante_id = medicoId)
      let totalDerivaciones = 0;
      if (medicoRol === 'medico_jefe') {
        totalDerivaciones = casos?.filter(c => c.estado === 'derivado' && c.medico_jefe_id === medicoId).length || 0;
      } else {
        totalDerivaciones = casos?.filter(c => c.estado === 'derivado' && c.medico_tratante_id === medicoId).length || 0;
      }

      // Porcentaje de aceptación de IA
      let casosConSugerenciaAceptar = 0;
      let casosAceptadosPorMedicoConSugerenciaAceptar = 0;

      casos?.forEach(caso => {
        const sugerencia = sugerenciasMap.get(caso.id);
        const resolucion = resolucionesMap.get(caso.id);
        
        if (sugerencia?.sugerencia === 'aceptar') {
          casosConSugerenciaAceptar++;
          if (resolucion?.decision_medico === 'aceptado' || caso.estado === 'aceptado') {
            casosAceptadosPorMedicoConSugerenciaAceptar++;
          }
        }
      });

      const porcentajeAceptacionIA = casosConSugerenciaAceptar > 0
        ? (casosAceptadosPorMedicoConSugerenciaAceptar / casosConSugerenciaAceptar) * 100
        : 0;

      // Casos aceptados por aseguradora (del total aceptados por médico)
      const casosAceptadosAseguradora = casos?.filter(c => 
        c.estado === 'aceptado' && 
        (c as any).estado_resolucion_aseguradora === 'aceptada'
      ).length || 0;

      // Casos rechazados por aseguradora (del total aceptados por médico)
      const casosRechazadosAseguradora = casos?.filter(c => 
        c.estado === 'aceptado' && 
        (c as any).estado_resolucion_aseguradora === 'rechazada'
      ).length || 0;

      // Casos pendientes de resolución por aseguradora
      const casosPendientesAseguradora = casos?.filter(c => 
        c.estado === 'aceptado' && 
        ((c as any).estado_resolucion_aseguradora === 'pendiente' || 
         (c as any).estado_resolucion_aseguradora === 'pendiente_envio')
      ).length || 0;

      // Tiempo promedio de resolución (en días)
      let tiempoTotalResolucion = 0;
      let casosConResolucion = 0;

      casos?.forEach(caso => {
        if (caso.estado === 'aceptado' || caso.estado === 'rechazado') {
          const fechaCreacion = new Date(caso.fecha_creacion);
          const fechaActualizacion = new Date(caso.fecha_actualizacion || caso.fecha_creacion);
          const diasDiferencia = (fechaActualizacion.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24);
          
          if (diasDiferencia > 0) {
            tiempoTotalResolucion += diasDiferencia;
            casosConResolucion++;
          }
        }
      });

      const tiempoPromedioResolucion = casosConResolucion > 0
        ? tiempoTotalResolucion / casosConResolucion
        : 0;

      const nuevasEstadisticas = {
        totalCasos,
        porcentajeAceptacionIA: Math.round(porcentajeAceptacionIA * 10) / 10,
        totalDerivaciones,
        casosAceptadosAseguradora,
        casosRechazadosAseguradora,
        casosPendientesAseguradora,
        casosAceptadosPorMedico,
        tiempoPromedioResolucion: Math.round(tiempoPromedioResolucion * 10) / 10,
      };

      setEstadisticas(nuevasEstadisticas);
      consoleLogDebugger('📊 Estadísticas cargadas:', nuevasEstadisticas);
    } catch (error: any) {
      consoleLogDebugger('Error cargando estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (medicoId) {
      loadEstadisticas();
    }
  }, [medicoId, rangoMetricas, fechaInicio, fechaFin]);

  const handleRangoMetricasChange = (value: RangoMetricas) => {
    setRangoMetricas(value);
    if (value !== 'custom') {
      setFechaInicio('');
      setFechaFin('');
    }
  };

  // Establecer fecha fin por defecto a hoy cuando se selecciona un rango
  useEffect(() => {
    if (rangoMetricas !== 'todos' && rangoMetricas !== 'custom' && !fechaFin) {
      const hoy = new Date().toISOString().split('T')[0];
      setFechaFin(hoy);
    }
  }, [rangoMetricas, fechaFin]);

  const derivacionesTexto = medicoRol === 'medico_jefe' 
    ? 'Casos derivados a este médico jefe' 
    : 'Casos que este médico derivó';

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Filtros de tiempo */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Tiempo</CardTitle>
          <CardDescription>Selecciona el período para las estadísticas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label className="mb-2">Rango de tiempo</Label>
              <Select value={rangoMetricas} onValueChange={handleRangoMetricasChange}>
                <SelectTrigger>
                  <Calendar className="h-4 w-4 mr-2" />
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
            </div>

            {rangoMetricas === 'custom' && (
              <>
                <div className="flex-1">
                  <Label className="mb-2">Fecha inicio</Label>
                  <Input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => {
                      setFechaInicio(e.target.value);
                      setRangoMetricas('custom');
                    }}
                  />
                </div>
                <div className="flex-1">
                  <Label className="mb-2">Fecha término</Label>
                  <Input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => {
                      setFechaFin(e.target.value);
                      setRangoMetricas('custom');
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFechaInicio('');
                    setFechaFin('');
                    handleRangoMetricasChange('todos');
                  }}
                >
                  Limpiar
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando estadísticas...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Grid de métricas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total de casos */}
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total de Casos</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">¿Cómo se calcula?</p>
                      <p className="text-xs">
                        {medicoRol === 'medico_jefe' 
                          ? 'Total de casos que fueron derivados a este médico jefe en el período seleccionado.'
                          : 'Total de casos registrados por este médico en el período seleccionado.'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold">{estadisticas.totalCasos}</div>
                  <Activity className="h-8 w-8 text-primary/60" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Casos registrados en el período</p>
              </CardContent>
            </Card>

            {/* Porcentaje de aceptación de IA */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Aceptación de IA</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">¿Cómo se calcula?</p>
                      <p className="text-xs">
                        Porcentaje de casos donde la IA recomendaba aceptar y el médico efectivamente aceptó el caso. 
                        Se calcula: (Casos aceptados cuando IA recomendaba aceptar / Total de casos donde IA recomendaba aceptar) × 100
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-green-600">{estadisticas.porcentajeAceptacionIA}%</div>
                  <Target className="h-8 w-8 text-green-500/60" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Cuando la IA recomendaba aceptar</p>
              </CardContent>
            </Card>

            {/* Derivaciones */}
            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Derivaciones</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">¿Cómo se calcula?</p>
                      <p className="text-xs">
                        {medicoRol === 'medico_jefe' 
                          ? 'Total de casos que fueron derivados a este médico jefe en el período seleccionado (casos con estado "derivado" donde este médico es el médico jefe asignado).'
                          : 'Total de casos que este médico derivó a un médico jefe en el período seleccionado (casos con estado "derivado" creados por este médico).'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-amber-600">{estadisticas.totalDerivaciones}</div>
                  <ArrowRightLeft className="h-8 w-8 text-amber-500/60" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{derivacionesTexto}</p>
              </CardContent>
            </Card>

            {/* Tiempo promedio de resolución */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tiempo Promedio</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">¿Cómo se calcula?</p>
                      <p className="text-xs">
                        Promedio de días transcurridos entre la creación del caso y su resolución final (aceptado o rechazado). 
                        Se calcula sumando los días de todos los casos resueltos y dividiendo por el total de casos resueltos.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-blue-600">{estadisticas.tiempoPromedioResolucion} días</div>
                  <Clock className="h-8 w-8 text-blue-500/60" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Promedio de resolución de casos</p>
              </CardContent>
            </Card>
          </div>

          {/* Estadísticas de aseguradora */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Resolución por Aseguradora</CardTitle>
                  <CardDescription>
                    Del total de casos aceptados por el médico ({estadisticas.casosAceptadosPorMedico})
                  </CardDescription>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold mb-1">¿Cómo se calcula?</p>
                    <p className="text-xs">
                      Estas métricas muestran el estado de resolución de la aseguradora (Fonasa/Isapre) 
                      para los casos que el médico aceptó. Solo se consideran casos con estado "aceptado" 
                      por el médico y se clasifican según su estado de resolución de aseguradora.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Aceptados */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="p-3 rounded-full bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-700">{estadisticas.casosAceptadosAseguradora}</div>
                    <div className="text-sm text-green-600">Aceptados</div>
                    {estadisticas.casosAceptadosPorMedico > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {Math.round((estadisticas.casosAceptadosAseguradora / estadisticas.casosAceptadosPorMedico) * 100)}% del total
                      </div>
                    )}
                  </div>
                </div>

                {/* Rechazados */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-red-50 border border-red-200">
                  <div className="p-3 rounded-full bg-red-100">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-700">{estadisticas.casosRechazadosAseguradora}</div>
                    <div className="text-sm text-red-600">Rechazados</div>
                    {estadisticas.casosAceptadosPorMedico > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {Math.round((estadisticas.casosRechazadosAseguradora / estadisticas.casosAceptadosPorMedico) * 100)}% del total
                      </div>
                    )}
                  </div>
                </div>

                {/* Pendientes */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="p-3 rounded-full bg-amber-100">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-700">{estadisticas.casosPendientesAseguradora}</div>
                    <div className="text-sm text-amber-600">Pendientes</div>
                    {estadisticas.casosAceptadosPorMedico > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {Math.round((estadisticas.casosPendientesAseguradora / estadisticas.casosAceptadosPorMedico) * 100)}% del total
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumen adicional */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumen de Decisiones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Casos aceptados</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {estadisticas.casosAceptadosPorMedico}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Casos rechazados</span>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    {estadisticas.totalCasos - estadisticas.casosAceptadosPorMedico - estadisticas.totalDerivaciones}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Derivaciones</span>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    {estadisticas.totalDerivaciones}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Eficiencia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tasa de aceptación</span>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {estadisticas.totalCasos > 0
                      ? Math.round((estadisticas.casosAceptadosPorMedico / estadisticas.totalCasos) * 100)
                      : 0}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tasa de derivación</span>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    {estadisticas.totalCasos > 0
                      ? Math.round((estadisticas.totalDerivaciones / estadisticas.totalCasos) * 100)
                      : 0}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tiempo promedio</span>
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                    {estadisticas.tiempoPromedioResolucion} días
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
    </TooltipProvider>
  );
}

