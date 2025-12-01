import { supabase } from '@/lib/supabase';

export interface DoctorBasicData {
  id: string;
  nombre: string;
  email: string;
  rol: 'medico' | 'medico_jefe';
  hospital?: string;
  especialidad?: string;
}

export interface DoctorCompleteMetrics {
  // Datos básicos
  id: string;
  nombre: string;
  email: string;
  rol: string;
  hospital?: string;
  especialidad?: string;
  
  // Métricas del dashboard de usuarios
  totalCasos: number;
  porcentajeAceptacionIA: number;
  totalDerivaciones: number;
  casosAceptadosAseguradora: number;
  casosRechazadosAseguradora: number;
  casosAceptadosPorMedico: number;
  
  // Métricas adicionales del dashboard detallado
  casosPendientesAseguradora: number;
  casosPendientesEnvioAseguradora: number;
  casosRechazadosPorMedico: number;
  tiempoPromedioResolucion: number; // en días
}

type RangoMetricas = 'todos' | '30' | '7' | '1' | 'custom';

interface DateRange {
  inicio: Date | null;
  fin: Date;
}

/**
 * Calcula el rango de fechas según el selector
 */
export function calculateDateRange(
  rangoMetricas: RangoMetricas,
  fechaInicio?: string,
  fechaFin?: string
): DateRange {
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
}

/**
 * Obtiene todas las métricas completas para un doctor
 */
export async function getDoctorCompleteMetrics(
  doctor: DoctorBasicData,
  dateRange: DateRange
): Promise<DoctorCompleteMetrics> {
  const { inicio, fin } = dateRange;

  // Construir query según el rol
  let casosQuery = supabase
    .from('casos')
    .select('id, estado, fecha_creacion, fecha_actualizacion, estado_resolucion_aseguradora, medico_tratante_id, medico_jefe_id');
  
  if (doctor.rol === 'medico_jefe') {
    casosQuery = casosQuery.eq('medico_jefe_id', doctor.id);
  } else {
    casosQuery = casosQuery.eq('medico_tratante_id', doctor.id);
  }

  if (inicio) {
    casosQuery = casosQuery.gte('fecha_creacion', inicio.toISOString());
    casosQuery = casosQuery.lte('fecha_creacion', fin.toISOString());
  }

  const { data: casos, error: casosError } = await casosQuery;
  if (casosError) throw casosError;

  const casosIds = casos?.map(c => c.id) || [];

  // Cargar sugerencias y resoluciones
  const [sugerenciasResult, resolucionesResult] = await Promise.all([
    supabase
      .from('sugerencia_ia')
      .select('caso_id, sugerencia')
      .in('caso_id', casosIds.length > 0 ? casosIds : ['00000000-0000-0000-0000-000000000000'])
      .order('fecha_procesamiento', { ascending: false }),
    supabase
      .from('resolucion_caso')
      .select('caso_id, decision_medico, decision_final')
      .in('caso_id', casosIds.length > 0 ? casosIds : ['00000000-0000-0000-0000-000000000000'])
  ]);

  const sugerencias = sugerenciasResult.data || [];
  const resoluciones = resolucionesResult.data || [];

  const sugerenciasMap = new Map(sugerencias.map(s => [s.caso_id, s]));
  const resolucionesMap = new Map(resoluciones.map(r => [r.caso_id, r]));

  // Calcular métricas básicas
  const totalCasos = casos?.length || 0;
  const casosAceptadosPorMedico = casos?.filter(c => c.estado === 'aceptado').length || 0;
  const casosRechazadosPorMedico = casos?.filter(c => c.estado === 'rechazado').length || 0;

  // Derivaciones
  let totalDerivaciones = 0;
  if (doctor.rol === 'medico_jefe') {
    const casosDerivados = casos?.filter(c => c.medico_jefe_id === doctor.id) || [];
    totalDerivaciones = casosDerivados.filter(c => {
      const resolucion = resolucionesMap.get(c.id);
      return resolucion && (resolucion.decision_final || resolucion.decision_medico);
    }).length;
  } else {
    totalDerivaciones = casos?.filter(c => 
      c.medico_tratante_id === doctor.id && 
      c.medico_jefe_id !== null && 
      c.medico_jefe_id !== undefined
    ).length || 0;
  }

  // Porcentaje aceptación IA
  let casosConSugerenciaAceptar = 0;
  let casosAceptadosConSugerenciaAceptar = 0;

  casos?.forEach(caso => {
    const sugerencia = sugerenciasMap.get(caso.id);
    const resolucion = resolucionesMap.get(caso.id);
    
    if (sugerencia?.sugerencia === 'aceptar') {
      casosConSugerenciaAceptar++;
      if (resolucion?.decision_medico === 'aceptado' || caso.estado === 'aceptado') {
        casosAceptadosConSugerenciaAceptar++;
      }
    }
  });

  const porcentajeAceptacionIA = casosConSugerenciaAceptar > 0
    ? (casosAceptadosConSugerenciaAceptar / casosConSugerenciaAceptar) * 100
    : 0;

  // Casos aceptados/rechazados por aseguradora
  const casosAceptadosAseguradora = casos?.filter(c => 
    c.estado === 'aceptado' && (c as any).estado_resolucion_aseguradora === 'aceptada'
  ).length || 0;

  const casosRechazadosAseguradora = casos?.filter(c => 
    c.estado === 'aceptado' && (c as any).estado_resolucion_aseguradora === 'rechazada'
  ).length || 0;

  const casosPendientesAseguradora = casos?.filter(c => 
    c.estado === 'aceptado' && (c as any).estado_resolucion_aseguradora === 'pendiente'
  ).length || 0;

  const casosPendientesEnvioAseguradora = casos?.filter(c => 
    c.estado === 'aceptado' && (c as any).estado_resolucion_aseguradora === 'pendiente_envio'
  ).length || 0;

  // Tiempo promedio de resolución
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

  return {
    // Datos básicos
    id: doctor.id,
    nombre: doctor.nombre,
    email: doctor.email,
    rol: doctor.rol === 'medico_jefe' ? 'Médico Jefe' : 'Médico',
    hospital: doctor.hospital,
    especialidad: doctor.especialidad,
    
    // Métricas
    totalCasos,
    porcentajeAceptacionIA: Math.round(porcentajeAceptacionIA * 10) / 10,
    totalDerivaciones,
    casosAceptadosAseguradora,
    casosRechazadosAseguradora,
    casosAceptadosPorMedico,
    casosPendientesAseguradora,
    casosPendientesEnvioAseguradora,
    casosRechazadosPorMedico,
    tiempoPromedioResolucion: Math.round(tiempoPromedioResolucion * 10) / 10,
  };
}

/**
 * Obtiene métricas completas para múltiples doctores
 */
export async function getMultipleDoctorsMetrics(
  doctors: DoctorBasicData[],
  dateRange: DateRange
): Promise<DoctorCompleteMetrics[]> {
  const metricsPromises = doctors.map(doctor => 
    getDoctorCompleteMetrics(doctor, dateRange).catch(error => {
      console.error(`Error obteniendo métricas para ${doctor.nombre}:`, error);
      // Retornar métricas vacías en caso de error
      return {
        id: doctor.id,
        nombre: doctor.nombre,
        email: doctor.email,
        rol: doctor.rol === 'medico_jefe' ? 'Médico Jefe' : 'Médico',
        hospital: doctor.hospital,
        especialidad: doctor.especialidad,
        totalCasos: 0,
        porcentajeAceptacionIA: 0,
        totalDerivaciones: 0,
        casosAceptadosAseguradora: 0,
        casosRechazadosAseguradora: 0,
        casosAceptadosPorMedico: 0,
        casosPendientesAseguradora: 0,
        casosPendientesEnvioAseguradora: 0,
        casosRechazadosPorMedico: 0,
        tiempoPromedioResolucion: 0,
      };
    })
  );

  return Promise.all(metricsPromises);
}

