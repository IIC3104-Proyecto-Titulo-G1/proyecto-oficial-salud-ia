import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx-js-style';
import { supabase } from '@/lib/supabase';
import { consoleLogDebugger } from '@/lib/utils';

interface Caso {
  id: string;
  nombre_paciente: string;
  diagnostico_principal: string;
  estado: 'pendiente' | 'aceptado' | 'rechazado' | 'derivado';
  fecha_creacion: string;
  fecha_actualizacion?: string;
  fecha_analisis_ia?: string;
  medico_tratante_id: string;
  medico_jefe_id?: string;
  episodio?: string;
  prevision?: string;
  estado_resolucion_aseguradora?: 'pendiente' | 'pendiente_envio' | 'aceptada' | 'rechazada';
  [key: string]: any; // Para campos adicionales
}

interface MedicoData {
  nombre: string;
  imagen: string | null;
  genero?: string | null;
  email?: string;
  especialidad?: string;
}

interface ExportCasosMetricsButtonProps {
  casosFiltrados: Caso[];
  casosParaMetricas: Caso[];
  metricas: {
    totalCasos: number;
    casosPendientes: number;
    casosDerivados: number;
    casosRechazados: number;
    casosAceptados: number;
    casosPendientesAseguradora: number;
    casosPendientesEnvioAseguradora: number;
    casosRechazadosAseguradora: number;
    casosAceptadosAseguradora: number;
  };
  filtros: {
    searchTerm: string;
    estadoFiltro: string;
    fechaInicio: string;
    fechaFin: string;
    filtroMedico: string;
    rangoMetricas: string;
    filtroPendienteAseguradora: boolean;
    filtroPendienteEnvioAseguradora: boolean;
    filtroRechazadosAseguradora: boolean;
    filtroAceptadosAseguradora: boolean;
  };
  medicosData: Record<string, MedicoData>;
  usuarioExportador?: string;
}

export function ExportCasosMetricsButton({
  casosFiltrados,
  casosParaMetricas,
  metricas,
  filtros,
  medicosData,
  usuarioExportador,
}: ExportCasosMetricsButtonProps) {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    if (casosFiltrados.length === 0) {
      toast({
        title: 'Sin datos para exportar',
        description: 'No hay casos que coincidan con los filtros aplicados',
        variant: 'destructive',
      });
      return;
    }

    setExporting(true);
    try {
      toast({
        title: 'Exportando métricas',
        description: `Procesando ${casosFiltrados.length} caso(s)...`,
      });

      // Obtener IDs de casos para cargar datos adicionales
      const casoIds = casosFiltrados.map(c => c.id);
      const medicoIds = [...new Set([
        ...casosFiltrados.map(c => c.medico_tratante_id),
        ...casosFiltrados.map(c => c.medico_jefe_id).filter(Boolean) as string[]
      ])];

      // Cargar sugerencias IA y resoluciones
      const [sugerenciasResult, resolucionesResult, medicosResult] = await Promise.all([
        supabase
          .from('sugerencia_ia')
          .select('caso_id, sugerencia, confianza, explicacion, fecha_procesamiento')
          .in('caso_id', casoIds.length > 0 ? casoIds : ['00000000-0000-0000-0000-000000000000']),
        supabase
          .from('resolucion_caso')
          .select('caso_id, decision_medico, decision_final, comentario_medico, comentario_final, fecha_decision_medico, fecha_decision_medico_jefe')
          .in('caso_id', casoIds.length > 0 ? casoIds : ['00000000-0000-0000-0000-000000000000']),
        supabase
          .from('user_roles')
          .select('user_id, nombre, email, especialidad, genero')
          .in('user_id', medicoIds.length > 0 ? medicoIds : ['00000000-0000-0000-0000-000000000000'])
      ]);

      const sugerencias = sugerenciasResult.data || [];
      const resoluciones = resolucionesResult.data || [];
      const medicosCompletos = medicosResult.data || [];

      // Crear mapas para acceso rápido
      const sugerenciasMap = new Map(sugerencias.map(s => [s.caso_id, s]));
      const resolucionesMap = new Map(resoluciones.map(r => [r.caso_id, r]));
      const medicosMap = new Map(medicosCompletos.map(m => [m.user_id, m]));

      // Crear workbook
      const wb = XLSX.utils.book_new();

      // ===== HOJA 1: RESUMEN DE MÉTRICAS =====
      const metricasData = [
        { 'Métrica': 'Total Casos Registrados', 'Valor': metricas.totalCasos },
        { 'Métrica': 'Casos Pendientes', 'Valor': metricas.casosPendientes },
        { 'Métrica': 'Casos Derivados', 'Valor': metricas.casosDerivados },
        { 'Métrica': 'Ley No Aplicada', 'Valor': metricas.casosRechazados },
        { 'Métrica': 'Ley Aplicada', 'Valor': metricas.casosAceptados },
        { 'Métrica': 'Pendiente Resolución Aseguradora', 'Valor': metricas.casosPendientesAseguradora },
        { 'Métrica': 'Pendiente Envío Aseguradora', 'Valor': metricas.casosPendientesEnvioAseguradora },
        { 'Métrica': 'Rechazados Aseguradora', 'Valor': metricas.casosRechazadosAseguradora },
        { 'Métrica': 'Aceptados Aseguradora', 'Valor': metricas.casosAceptadosAseguradora },
      ];

      const wsMetricas = XLSX.utils.json_to_sheet(metricasData);
      const rangeMetricas = XLSX.utils.decode_range(wsMetricas['!ref'] || 'A1');

      // Estilos para hoja de métricas
      const headerMetricasStyle = {
        fill: { fgColor: { rgb: '2D7A32' } }, // Verde oscuro
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: {
          top: { style: 'medium', color: { rgb: '000000' } },
          bottom: { style: 'medium', color: { rgb: '000000' } },
          left: { style: 'medium', color: { rgb: '000000' } },
          right: { style: 'medium', color: { rgb: '000000' } }
        }
      };

      const valueMetricasStyle = {
        fill: { fgColor: { rgb: 'C8E6C9' } }, // Verde claro
        font: { sz: 11 },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };

      // Aplicar estilos a métricas
      for (let row = rangeMetricas.s.r; row <= rangeMetricas.e.r; row++) {
        for (let col = rangeMetricas.s.c; col <= rangeMetricas.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!wsMetricas[cellAddress]) continue;

          if (row === rangeMetricas.s.r) {
            wsMetricas[cellAddress].s = headerMetricasStyle;
          } else {
            if (col === rangeMetricas.s.c) {
              wsMetricas[cellAddress].s = {
                ...valueMetricasStyle,
                alignment: { ...valueMetricasStyle.alignment, horizontal: 'left' }
              };
            } else {
              wsMetricas[cellAddress].s = valueMetricasStyle;
            }
          }
        }
      }

      wsMetricas['!cols'] = [
        { wch: 35 },
        { wch: 15 }
      ];
      wsMetricas['!rows'] = [
        { hpt: 25 },
        ...Array(rangeMetricas.e.r - rangeMetricas.s.r).fill({ hpt: 20 })
      ];

      XLSX.utils.book_append_sheet(wb, wsMetricas, 'Resumen Métricas');

      // ===== HOJA 2: CONFIGURACIÓN =====
      const configData = [];
      
      // Determinar período
      let tipoPeriodo = '';
      let fechaInicioFormato = '';
      let fechaFinFormato = '';
      
      if (filtros.rangoMetricas === 'todos') {
        tipoPeriodo = 'Histórico (Todos los registros)';
        fechaInicioFormato = 'No aplica';
        fechaFinFormato = new Date().toLocaleDateString('es-CL');
      } else if (filtros.rangoMetricas === 'custom') {
        tipoPeriodo = 'Período Personalizado';
        fechaInicioFormato = filtros.fechaInicio ? new Date(filtros.fechaInicio).toLocaleDateString('es-CL') : 'No especificado';
        fechaFinFormato = filtros.fechaFin ? new Date(filtros.fechaFin).toLocaleDateString('es-CL') : 'No especificado';
      } else {
        const dias = filtros.rangoMetricas === '30' ? 30 : filtros.rangoMetricas === '7' ? 7 : 1;
        tipoPeriodo = dias === 1 ? 'Último Día' : `Últimos ${dias} Días`;
        fechaInicioFormato = filtros.fechaInicio ? new Date(filtros.fechaInicio).toLocaleDateString('es-CL') : 'No especificado';
        fechaFinFormato = filtros.fechaFin ? new Date(filtros.fechaFin).toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL');
      }

      configData.push(
        { 'Campo': 'Usuario que Exportó', 'Valor': usuarioExportador || 'Administrador' },
        { 'Campo': 'Fecha de Exportación', 'Valor': new Date().toLocaleDateString('es-CL') + ' ' + new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) },
        { 'Campo': 'Tipo de Período', 'Valor': tipoPeriodo },
        { 'Campo': 'Fecha de Inicio', 'Valor': fechaInicioFormato },
        { 'Campo': 'Fecha de Término', 'Valor': fechaFinFormato },
        { 'Campo': 'Total de Casos Exportados', 'Valor': casosFiltrados.length }
      );

      // Agregar filtros aplicados
      if (filtros.searchTerm) {
        configData.push({ 'Campo': 'Filtro: Búsqueda', 'Valor': filtros.searchTerm });
      }
      
      if (filtros.estadoFiltro !== 'todos') {
        const estadoLabels: Record<string, string> = {
          'pendiente': 'Pendiente',
          'aceptado': 'Aceptado',
          'rechazado': 'Rechazado',
          'derivado': 'Derivado'
        };
        configData.push({ 'Campo': 'Filtro: Estado', 'Valor': estadoLabels[filtros.estadoFiltro] || filtros.estadoFiltro });
      }

      if (filtros.filtroMedico !== 'todos') {
        const medico = medicosData[filtros.filtroMedico];
        configData.push({ 'Campo': 'Filtro: Médico', 'Valor': medico ? medico.nombre : filtros.filtroMedico });
      }

      if (filtros.filtroPendienteAseguradora) {
        configData.push({ 'Campo': 'Filtro: Pendiente Resolución Aseguradora', 'Valor': 'Sí' });
      }

      if (filtros.filtroPendienteEnvioAseguradora) {
        configData.push({ 'Campo': 'Filtro: Pendiente Envío Aseguradora', 'Valor': 'Sí' });
      }

      if (filtros.filtroRechazadosAseguradora) {
        configData.push({ 'Campo': 'Filtro: Rechazados Aseguradora', 'Valor': 'Sí' });
      }

      if (filtros.filtroAceptadosAseguradora) {
        configData.push({ 'Campo': 'Filtro: Aceptados Aseguradora', 'Valor': 'Sí' });
      }

      const wsConfig = XLSX.utils.json_to_sheet(configData);
      const rangeConfig = XLSX.utils.decode_range(wsConfig['!ref'] || 'A1');

      // Estilos para hoja de configuración
      const headerConfigStyle = {
        fill: { fgColor: { rgb: '388E3C' } }, // Verde medio
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: {
          top: { style: 'medium', color: { rgb: '000000' } },
          bottom: { style: 'medium', color: { rgb: '000000' } },
          left: { style: 'medium', color: { rgb: '000000' } },
          right: { style: 'medium', color: { rgb: '000000' } }
        }
      };

      const valueConfigStyle = {
        fill: { fgColor: { rgb: 'E8F5E9' } }, // Verde muy claro
        font: { sz: 11 },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };

      // Aplicar estilos a configuración
      for (let row = rangeConfig.s.r; row <= rangeConfig.e.r; row++) {
        for (let col = rangeConfig.s.c; col <= rangeConfig.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!wsConfig[cellAddress]) continue;

          if (row === rangeConfig.s.r) {
            wsConfig[cellAddress].s = headerConfigStyle;
          } else {
            wsConfig[cellAddress].s = valueConfigStyle;
          }
        }
      }

      // Calcular ancho de columnas
      let maxCampoWidth = 10;
      let maxValorWidth = 10;
      
      for (let row = rangeConfig.s.r; row <= rangeConfig.e.r; row++) {
        for (let col = rangeConfig.s.c; col <= rangeConfig.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = wsConfig[cellAddress];
          if (cell && cell.v) {
            const cellValue = String(cell.v);
            const cellLength = cellValue.length;
            
            if (col === rangeConfig.s.c) {
              maxCampoWidth = Math.max(maxCampoWidth, cellLength);
            } else if (col === rangeConfig.e.c) {
              maxValorWidth = Math.max(maxValorWidth, cellLength);
            }
          }
        }
      }

      wsConfig['!cols'] = [
        { wch: Math.min(Math.max(maxCampoWidth + 2, 20), 50) },
        { wch: Math.min(Math.max(maxValorWidth + 2, 30), 80) }
      ];
      wsConfig['!rows'] = [
        { hpt: 25 },
        ...Array(rangeConfig.e.r - rangeConfig.s.r).fill({ hpt: 20 })
      ];

      XLSX.utils.book_append_sheet(wb, wsConfig, 'Configuración');

      // ===== HOJA 3: DETALLE DE CASOS =====
      const casosDetalle = casosFiltrados.map(caso => {
        const sugerencia = sugerenciasMap.get(caso.id);
        const resolucion = resolucionesMap.get(caso.id);
        const medicoTratante = medicosMap.get(caso.medico_tratante_id) || medicosData[caso.medico_tratante_id];
        const medicoJefe = caso.medico_jefe_id ? (medicosMap.get(caso.medico_jefe_id) || medicosData[caso.medico_jefe_id]) : null;

        return {
          'ID Caso': caso.id,
          'Episodio': caso.episodio || '',
          'Estado': caso.estado,
          'Estado Resolución Aseguradora': caso.estado_resolucion_aseguradora || '',
          'Previsión': caso.prevision || '',
          'Nombre Isapre': (caso as any).nombre_isapre || '',
          'Centro': (caso as any).centro || '',
          'Tipo Cama': (caso as any).tipo_cama || '',
          'Triage': (caso as any).triage || '',
          'Fecha Ingreso': (caso as any).fecha_ingreso ? new Date((caso as any).fecha_ingreso).toLocaleString('es-CL') : '',
          'Nombre Paciente': caso.nombre_paciente,
          'Edad Paciente': (caso as any).edad_paciente || '',
          'Sexo Paciente': (caso as any).sexo_paciente || '',
          'Email Paciente': (caso as any).email_paciente || '',
          'Diagnóstico Principal': caso.diagnostico_principal,
          'Síntomas': (caso as any).sintomas || '',
          'Historia Clínica': (caso as any).historia_clinica || '',
          'Descripción Adicional': (caso as any).descripcion_adicional || '',
          'Presión Arterial': (caso as any).presion_arterial || '',
          'PA Sistólica': (caso as any).pa_sistolica || '',
          'PA Diastólica': (caso as any).pa_diastolica || '',
          'PA Media': (caso as any).pa_media || '',
          'Frecuencia Cardiaca': (caso as any).frecuencia_cardiaca || '',
          'FC': (caso as any).fc || '',
          'Temperatura': (caso as any).temperatura || '',
          'Temperatura C': (caso as any).temperatura_c || '',
          'Saturación Oxígeno': (caso as any).saturacion_oxigeno || '',
          'Sat O2': (caso as any).sat_o2 || '',
          'Frecuencia Respiratoria': (caso as any).frecuencia_respiratoria || '',
          'FR': (caso as any).fr || '',
          'FiO2': (caso as any).fio2 || '',
          'FiO2 >= 50%': (caso as any).fio2_ge_50 ? 'Sí' : 'No',
          'Glasgow': (caso as any).glasgow || '',
          'Hemoglobina': (caso as any).hb || '',
          'Creatinina': (caso as any).creatinina || '',
          'BUN': (caso as any).bun || '',
          'Sodio': (caso as any).sodio || '',
          'Potasio': (caso as any).potasio || '',
          'Transfusiones': (caso as any).transfusiones || '',
          'Antecedentes Cardíacos': (caso as any).antecedentes_cardiacos ? 'Sí' : 'No',
          'Antecedentes Diabéticos': (caso as any).antecedentes_diabeticos ? 'Sí' : 'No',
          'Antecedentes HTA': (caso as any).antecedentes_hta ? 'Sí' : 'No',
          'Compromiso Conciencia': (caso as any).compromiso_conciencia ? 'Sí' : 'No',
          'ECG Alterado': (caso as any).ecg_alterado ? 'Sí' : 'No',
          'Troponinas Alteradas': (caso as any).troponinas_alteradas ? 'Sí' : 'No',
          'PCR': (caso as any).pcr ? 'Sí' : 'No',
          'Ventilación Mecánica': (caso as any).vm ? 'Sí' : 'No',
          'DREO': (caso as any).dreo ? 'Sí' : 'No',
          'DVA': (caso as any).dva ? 'Sí' : 'No',
          'Diálisis': (caso as any).dialisis ? 'Sí' : 'No',
          'Cirugía': (caso as any).cirugia ? 'Sí' : 'No',
          'Cirugía Same Day': (caso as any).cirugia_same_day ? 'Sí' : 'No',
          'Hemodinamia': (caso as any).hemodinamia ? 'Sí' : 'No',
          'Hemodinamia Same Day': (caso as any).hemodinamia_same_day ? 'Sí' : 'No',
          'Endoscopia': (caso as any).endoscopia ? 'Sí' : 'No',
          'Endoscopia Same Day': (caso as any).endoscopia_same_day ? 'Sí' : 'No',
          'Trombolisis': (caso as any).trombolisis ? 'Sí' : 'No',
          'Trombolisis Same Day': (caso as any).trombolisis_same_day ? 'Sí' : 'No',
          'RNM Protocol Stroke': (caso as any).rnm_protocol_stroke ? 'Sí' : 'No',
          'Fecha Creación': caso.fecha_creacion ? new Date(caso.fecha_creacion).toLocaleString('es-CL') : '',
          'Fecha Actualización': caso.fecha_actualizacion ? new Date(caso.fecha_actualizacion).toLocaleString('es-CL') : '',
          'Fecha Análisis IA': caso.fecha_analisis_ia ? new Date(caso.fecha_analisis_ia).toLocaleString('es-CL') : '',
          'Sugerencia IA': sugerencia?.sugerencia || '',
          'Confianza IA': sugerencia?.confianza || '',
          'Explicación IA': sugerencia?.explicacion || '',
          'Fecha Procesamiento IA': sugerencia?.fecha_procesamiento ? new Date(sugerencia.fecha_procesamiento).toLocaleString('es-CL') : '',
          'Decisión Médico': resolucion?.decision_medico || '',
          'Comentario Médico': resolucion?.comentario_medico || '',
          'Decisión Final': resolucion?.decision_final || '',
          'Comentario Final': resolucion?.comentario_final || '',
          'Fecha Decisión Médico': resolucion?.fecha_decision_medico ? new Date(resolucion.fecha_decision_medico).toLocaleString('es-CL') : '',
          'Fecha Decisión Médico Jefe': resolucion?.fecha_decision_medico_jefe ? new Date(resolucion.fecha_decision_medico_jefe).toLocaleString('es-CL') : '',
          'ID Médico Tratante': caso.medico_tratante_id,
          'Nombre Médico Tratante': medicoTratante?.nombre || '',
          'Email Médico Tratante': medicoTratante?.email || '',
          'Especialidad Médico Tratante': medicoTratante?.especialidad || '',
          'ID Médico Jefe': caso.medico_jefe_id || '',
          'Nombre Médico Jefe': medicoJefe?.nombre || '',
          'Email Médico Jefe': medicoJefe?.email || '',
          'Especialidad Médico Jefe': medicoJefe?.especialidad || '',
        };
      });

      const wsDetalle = XLSX.utils.json_to_sheet(casosDetalle);
      const rangeDetalle = XLSX.utils.decode_range(wsDetalle['!ref'] || 'A1');

      // Estilos para hoja de detalle
      const headerDetalleStyle = {
        fill: { fgColor: { rgb: '1B5E20' } }, // Verde muy oscuro
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };

      const evenRowStyle = {
        fill: { fgColor: { rgb: 'E8F5E9' } }, // Verde muy claro
        font: { sz: 10 },
        alignment: { vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'C8E6C9' } },
          bottom: { style: 'thin', color: { rgb: 'C8E6C9' } },
          left: { style: 'thin', color: { rgb: 'C8E6C9' } },
          right: { style: 'thin', color: { rgb: 'C8E6C9' } }
        }
      };

      const oddRowStyle = {
        fill: { fgColor: { rgb: 'FFFFFF' } }, // Blanco
        font: { sz: 10 },
        alignment: { vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'C8E6C9' } },
          bottom: { style: 'thin', color: { rgb: 'C8E6C9' } },
          left: { style: 'thin', color: { rgb: 'C8E6C9' } },
          right: { style: 'thin', color: { rgb: 'C8E6C9' } }
        }
      };

      // Aplicar estilos a detalle
      for (let row = rangeDetalle.s.r; row <= rangeDetalle.e.r; row++) {
        for (let col = rangeDetalle.s.c; col <= rangeDetalle.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!wsDetalle[cellAddress]) continue;

          if (row === rangeDetalle.s.r) {
            wsDetalle[cellAddress].s = headerDetalleStyle;
          } else {
            const isEven = (row - rangeDetalle.s.r) % 2 === 0;
            const rowStyle = isEven ? evenRowStyle : oddRowStyle;
            wsDetalle[cellAddress].s = { ...wsDetalle[cellAddress].s, ...rowStyle };
            
            // Alineación especial para columnas numéricas
            const colIndex = col - rangeDetalle.s.c;
            // Columnas numéricas: Edad (11), PA Sistólica (19), PA Diastólica (20), PA Media (21), FC (23), Temperatura (24-25), Sat O2 (27-28), FR (29-30), FiO2 (31), Glasgow (33), Hemoglobina (34), Creatinina (35), BUN (36), Sodio (37), Potasio (38), Transfusiones (39), Confianza IA (65)
            const numericCols = [11, 19, 20, 21, 23, 24, 25, 27, 28, 29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 65];
            if (numericCols.includes(colIndex)) {
              wsDetalle[cellAddress].s.alignment = {
                ...wsDetalle[cellAddress].s.alignment,
                horizontal: 'right'
              };
            } else {
              wsDetalle[cellAddress].s.alignment = {
                ...wsDetalle[cellAddress].s.alignment,
                horizontal: 'left'
              };
            }
          }
        }
      }

      // Ajustar ancho de columnas (ajustado para todos los campos)
      const colWidths = [
        { wch: 36 }, // ID Caso
        { wch: 20 }, // Episodio
        { wch: 15 }, // Estado
        { wch: 25 }, // Estado Resolución Aseguradora
        { wch: 15 }, // Previsión
        { wch: 20 }, // Nombre Isapre
        { wch: 20 }, // Centro
        { wch: 15 }, // Tipo Cama
        { wch: 15 }, // Triage
        { wch: 20 }, // Fecha Ingreso
        { wch: 25 }, // Nombre Paciente
        { wch: 12 }, // Edad Paciente
        { wch: 12 }, // Sexo Paciente
        { wch: 30 }, // Email Paciente
        { wch: 40 }, // Diagnóstico Principal
        { wch: 40 }, // Síntomas
        { wch: 40 }, // Historia Clínica
        { wch: 40 }, // Descripción Adicional
        { wch: 18 }, // Presión Arterial
        { wch: 12 }, // PA Sistólica
        { wch: 12 }, // PA Diastólica
        { wch: 12 }, // PA Media
        { wch: 18 }, // Frecuencia Cardiaca
        { wch: 10 }, // FC
        { wch: 12 }, // Temperatura
        { wch: 12 }, // Temperatura C
        { wch: 18 }, // Saturación Oxígeno
        { wch: 10 }, // Sat O2
        { wch: 20 }, // Frecuencia Respiratoria
        { wch: 10 }, // FR
        { wch: 10 }, // FiO2
        { wch: 12 }, // FiO2 >= 50%
        { wch: 10 }, // Glasgow
        { wch: 12 }, // Hemoglobina
        { wch: 12 }, // Creatinina
        { wch: 10 }, // BUN
        { wch: 10 }, // Sodio
        { wch: 10 }, // Potasio
        { wch: 15 }, // Transfusiones
        { wch: 20 }, // Antecedentes Cardíacos
        { wch: 20 }, // Antecedentes Diabéticos
        { wch: 15 }, // Antecedentes HTA
        { wch: 20 }, // Compromiso Conciencia
        { wch: 15 }, // ECG Alterado
        { wch: 20 }, // Troponinas Alteradas
        { wch: 10 }, // PCR
        { wch: 20 }, // Ventilación Mecánica
        { wch: 10 }, // DREO
        { wch: 10 }, // DVA
        { wch: 12 }, // Diálisis
        { wch: 12 }, // Cirugía
        { wch: 18 }, // Cirugía Same Day
        { wch: 15 }, // Hemodinamia
        { wch: 20 }, // Hemodinamia Same Day
        { wch: 15 }, // Endoscopia
        { wch: 20 }, // Endoscopia Same Day
        { wch: 15 }, // Trombolisis
        { wch: 20 }, // Trombolisis Same Day
        { wch: 20 }, // RNM Protocol Stroke
        { wch: 20 }, // Fecha Creación
        { wch: 20 }, // Fecha Actualización
        { wch: 20 }, // Fecha Análisis IA
        { wch: 15 }, // Sugerencia IA
        { wch: 12 }, // Confianza IA
        { wch: 50 }, // Explicación IA
        { wch: 20 }, // Fecha Procesamiento IA
        { wch: 15 }, // Decisión Médico
        { wch: 40 }, // Comentario Médico
        { wch: 15 }, // Decisión Final
        { wch: 40 }, // Comentario Final
        { wch: 20 }, // Fecha Decisión Médico
        { wch: 20 }, // Fecha Decisión Médico Jefe
        { wch: 36 }, // ID Médico Tratante
        { wch: 25 }, // Nombre Médico Tratante
        { wch: 30 }, // Email Médico Tratante
        { wch: 20 }, // Especialidad Médico Tratante
        { wch: 36 }, // ID Médico Jefe
        { wch: 25 }, // Nombre Médico Jefe
        { wch: 30 }, // Email Médico Jefe
        { wch: 20 }, // Especialidad Médico Jefe
      ];
      wsDetalle['!cols'] = colWidths;
      wsDetalle['!rows'] = [{ hpt: 30 }, ...Array(rangeDetalle.e.r - rangeDetalle.s.r).fill({ hpt: 20 })];

      XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle Casos');

      // Generar nombre de archivo
      let nombreArchivo = 'metricas_casos_';
      if (filtros.rangoMetricas === 'todos') {
        nombreArchivo += 'historico';
      } else if (filtros.rangoMetricas === 'custom' && filtros.fechaInicio && filtros.fechaFin) {
        const fechaInicio = filtros.fechaInicio.replace(/-/g, '');
        const fechaFin = filtros.fechaFin.replace(/-/g, '');
        nombreArchivo += `${fechaInicio}_${fechaFin}`;
      } else {
        const fechaFin = filtros.fechaFin ? filtros.fechaFin.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
        nombreArchivo += `${filtros.rangoMetricas}dias_${fechaFin}`;
      }
      nombreArchivo += '.xlsx';

      // Descargar archivo
      XLSX.writeFile(wb, nombreArchivo);

      toast({
        title: 'Exportación exitosa',
        description: `Se exportaron ${casosFiltrados.length} caso(s) con todas las métricas`,
      });
    } catch (error: any) {
      consoleLogDebugger('Error exportando métricas:', error);
      toast({
        title: 'Error al exportar',
        description: error.message || 'Ocurrió un error al generar el archivo Excel',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={exporting || casosFiltrados.length === 0}
      variant="outline"
      className="gap-2"
    >
      {exporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Exportando...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Exportar Métricas
        </>
      )}
    </Button>
  );
}

