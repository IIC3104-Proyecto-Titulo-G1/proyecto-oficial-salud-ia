import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx-js-style';
import { 
  getMultipleDoctorsMetrics, 
  calculateDateRange,
  type DoctorBasicData,
  type DoctorCompleteMetrics 
} from '@/services/doctorMetricsService';
import { consoleLogDebugger } from '@/lib/utils';

interface FiltroMetrica {
  id: string;
  tipo: 'totalCasos' | 'porcentajeAceptacionIA' | 'totalDerivaciones' | 'casosAceptadosAseguradora' | 'casosRechazadosAseguradora';
  operador: 'mayor_igual' | 'menor_igual';
  valor: number;
}

interface ExportDoctorMetricsButtonProps {
  doctors: DoctorBasicData[];
  rangoMetricas: 'todos' | '30' | '7' | '1' | 'custom';
  fechaInicioMetricas?: string;
  fechaFinMetricas?: string;
  usuarioExportador?: string;
  filtrosAplicados?: {
    busqueda?: string;
    rolFiltro?: string;
    filtrosMetricas?: FiltroMetrica[];
  };
}

export function ExportDoctorMetricsButton({
  doctors,
  rangoMetricas,
  fechaInicioMetricas,
  fechaFinMetricas,
  usuarioExportador,
  filtrosAplicados,
}: ExportDoctorMetricsButtonProps) {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    if (doctors.length === 0) {
      toast({
        title: 'Sin datos para exportar',
        description: 'No hay doctores seleccionados para exportar',
        variant: 'destructive',
      });
      return;
    }

    setExporting(true);
    try {
      // Calcular rango de fechas
      const dateRange = calculateDateRange(
        rangoMetricas,
        fechaInicioMetricas,
        fechaFinMetricas
      );

      // Obtener métricas para todos los doctores
      toast({
        title: 'Exportando métricas',
        description: `Obteniendo métricas para ${doctors.length} doctor(es)...`,
      });

      const metrics = await getMultipleDoctorsMetrics(doctors, dateRange);

      // Preparar datos para Excel
      const excelData = metrics.map(metric => ({
        'ID': metric.id,
        'Nombre': metric.nombre,
        'Correo': metric.email,
        'Rol': metric.rol,
        'Hospital': metric.hospital || '',
        'Especialidad': metric.especialidad || '',
        'Total Casos': metric.totalCasos,
        '% Aceptación IA': metric.porcentajeAceptacionIA,
        'Derivaciones': metric.totalDerivaciones,
        'Casos Aceptados por Médico': metric.casosAceptadosPorMedico,
        'Casos Rechazados por Médico': metric.casosRechazadosPorMedico,
        'Casos Aceptados Aseguradora': metric.casosAceptadosAseguradora,
        'Casos Rechazados Aseguradora': metric.casosRechazadosAseguradora,
        'Casos Pendientes Aseguradora': metric.casosPendientesAseguradora,
        'Casos Pendientes Envío Aseguradora': metric.casosPendientesEnvioAseguradora,
        'Tiempo Promedio Resolución (días)': metric.tiempoPromedioResolucion,
      }));

      // Crear workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Obtener el rango de celdas
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      
      // Estilos para el header
      const headerStyle = {
        fill: {
          fgColor: { rgb: '4472C4' } // Azul
        },
        font: {
          bold: true,
          color: { rgb: 'FFFFFF' }, // Blanco
          sz: 11
        },
        alignment: {
          horizontal: 'center',
          vertical: 'center',
          wrapText: true
        },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };

      // Aplicar estilos al header (fila 1)
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) continue;
        ws[cellAddress].s = headerStyle;
      }

      // Estilos para filas de datos (franjas alternadas)
      const evenRowStyle = {
        fill: {
          fgColor: { rgb: 'D6E9F5' } // Celeste claro
        },
        font: {
          sz: 10
        },
        alignment: {
          vertical: 'center'
        },
        border: {
          top: { style: 'thin', color: { rgb: 'B3D9FF' } },
          bottom: { style: 'thin', color: { rgb: 'B3D9FF' } },
          left: { style: 'thin', color: { rgb: 'B3D9FF' } },
          right: { style: 'thin', color: { rgb: 'B3D9FF' } }
        }
      };

      const oddRowStyle = {
        fill: {
          fgColor: { rgb: 'FFFFFF' } // Blanco
        },
        font: {
          sz: 10
        },
        alignment: {
          vertical: 'center'
        },
        border: {
          top: { style: 'thin', color: { rgb: 'B3D9FF' } },
          bottom: { style: 'thin', color: { rgb: 'B3D9FF' } },
          left: { style: 'thin', color: { rgb: 'B3D9FF' } },
          right: { style: 'thin', color: { rgb: 'B3D9FF' } }
        }
      };

      // Aplicar estilos a las filas de datos (franjas alternadas)
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const isEven = (row - range.s.r) % 2 === 0;
        const rowStyle = isEven ? evenRowStyle : oddRowStyle;
        
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!ws[cellAddress]) continue;
          
          // Si la celda no tiene estilo, inicializarla
          if (!ws[cellAddress].s) {
            ws[cellAddress].s = {};
          }
          
          // Aplicar estilo de fila
          ws[cellAddress].s = { ...ws[cellAddress].s, ...rowStyle };
          
          // Alineación especial para columnas numéricas
          const colIndex = col - range.s.c;
          if (colIndex >= 6) { // Columnas numéricas (desde "Total Casos")
            ws[cellAddress].s.alignment = {
              ...ws[cellAddress].s.alignment,
              horizontal: 'right'
            };
          } else {
            ws[cellAddress].s.alignment = {
              ...ws[cellAddress].s.alignment,
              horizontal: 'left'
            };
          }
        }
      }

      // Ajustar ancho de columnas
      const colWidths = [
        { wch: 36 }, // ID
        { wch: 25 }, // Nombre
        { wch: 30 }, // Correo
        { wch: 15 }, // Rol
        { wch: 25 }, // Hospital
        { wch: 20 }, // Especialidad
        { wch: 12 }, // Total Casos
        { wch: 18 }, // % Aceptación IA
        { wch: 15 }, // Derivaciones
        { wch: 25 }, // Casos Aceptados por Médico
        { wch: 25 }, // Casos Rechazados por Médico
        { wch: 28 }, // Casos Aceptados Aseguradora
        { wch: 28 }, // Casos Rechazados Aseguradora
        { wch: 30 }, // Casos Pendientes Aseguradora
        { wch: 35 }, // Casos Pendientes Envío Aseguradora
        { wch: 32 }, // Tiempo Promedio Resolución
      ];
      ws['!cols'] = colWidths;

      // Ajustar altura de la fila del header
      ws['!rows'] = [{ hpt: 30 }];

      // Agregar hoja al workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Métricas Doctores');

      // Crear segunda hoja con información del período
      const infoData = [];
      
      // Determinar el tipo de período
      let tipoPeriodo = '';
      let fechaInicioFormato = '';
      let fechaFinFormato = '';
      
      if (rangoMetricas === 'todos') {
        tipoPeriodo = 'Histórico (Todos los registros)';
        fechaInicioFormato = 'No aplica';
        fechaFinFormato = new Date().toLocaleDateString('es-CL');
      } else if (rangoMetricas === 'custom' && fechaInicioMetricas && fechaFinMetricas) {
        tipoPeriodo = 'Período Personalizado';
        fechaInicioFormato = new Date(fechaInicioMetricas).toLocaleDateString('es-CL');
        fechaFinFormato = new Date(fechaFinMetricas).toLocaleDateString('es-CL');
      } else {
        const inicio = dateRange.inicio;
        const fin = dateRange.fin;
        
        if (rangoMetricas === '1') {
          tipoPeriodo = 'Último Día';
        } else if (rangoMetricas === '7') {
          tipoPeriodo = 'Últimos 7 Días';
        } else if (rangoMetricas === '30') {
          tipoPeriodo = 'Últimos 30 Días';
        }
        
        if (inicio) {
          fechaInicioFormato = inicio.toLocaleDateString('es-CL');
        } else {
          fechaInicioFormato = 'No aplica';
        }
        fechaFinFormato = fin.toLocaleDateString('es-CL');
      }

      // Agregar información básica
      infoData.push(
        { 'Campo': 'Usuario que Exportó', 'Valor': usuarioExportador || 'No especificado' },
        { 'Campo': 'Tipo de Período', 'Valor': tipoPeriodo },
        { 'Campo': 'Fecha de Inicio', 'Valor': fechaInicioFormato },
        { 'Campo': 'Fecha de Término', 'Valor': fechaFinFormato },
        { 'Campo': 'Fecha de Exportación', 'Valor': new Date().toLocaleDateString('es-CL') + ' ' + new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) },
        { 'Campo': 'Total de Doctores Exportados', 'Valor': metrics.length },
        { 'Campo': 'Rango de Filtro Temporal', 'Valor': rangoMetricas === 'todos' ? 'Todos' : rangoMetricas === 'custom' ? 'Personalizado' : `${rangoMetricas} días` }
      );

      // Agregar cada filtro como una fila separada
      if (filtrosAplicados?.busqueda) {
        infoData.push({ 'Campo': 'Filtro: Búsqueda', 'Valor': filtrosAplicados.busqueda });
      }
      
      if (filtrosAplicados?.rolFiltro && filtrosAplicados.rolFiltro !== 'todos') {
        const rolLabels: Record<string, string> = {
          'medico': 'Médico',
          'medico_jefe': 'Médico Jefe',
          'doctores': 'Doctores (Médicos y Médicos Jefe)',
          'admin': 'Administrador'
        };
        infoData.push({ 
          'Campo': 'Filtro: Rol', 
          'Valor': rolLabels[filtrosAplicados.rolFiltro] || filtrosAplicados.rolFiltro 
        });
      }
      
      if (filtrosAplicados?.filtrosMetricas && filtrosAplicados.filtrosMetricas.length > 0) {
        const metricaLabels: Record<string, string> = {
          'totalCasos': 'Total de Casos',
          'porcentajeAceptacionIA': '% Aceptación IA',
          'totalDerivaciones': 'Derivaciones',
          'casosAceptadosAseguradora': 'Casos Aceptados Aseguradora',
          'casosRechazadosAseguradora': 'Casos Rechazados Aseguradora'
        };
        const operadorLabels: Record<string, string> = {
          'mayor_igual': '≥',
          'menor_igual': '≤'
        };
        
        filtrosAplicados.filtrosMetricas.forEach((filtro, index) => {
          const label = metricaLabels[filtro.tipo] || filtro.tipo;
          const operador = operadorLabels[filtro.operador] || filtro.operador;
          const valor = filtro.tipo === 'porcentajeAceptacionIA' ? `${filtro.valor}%` : filtro.valor;
          infoData.push({ 
            'Campo': `Filtro de Métrica ${index + 1}: ${label}`, 
            'Valor': `${operador} ${valor}` 
          });
        });
      }

      // Si no hay filtros, agregar una fila indicándolo
      if (!filtrosAplicados?.busqueda && 
          (!filtrosAplicados?.rolFiltro || filtrosAplicados.rolFiltro === 'todos') && 
          (!filtrosAplicados?.filtrosMetricas || filtrosAplicados.filtrosMetricas.length === 0)) {
        infoData.push({ 'Campo': 'Filtros Aplicados', 'Valor': 'Ninguno' });
      }

      const wsInfo = XLSX.utils.json_to_sheet(infoData);
      const rangeInfo = XLSX.utils.decode_range(wsInfo['!ref'] || 'A1');

      // Estilos para la hoja de información
      const headerInfoStyle = {
        fill: {
          fgColor: { rgb: '2E75B6' } // Azul más oscuro
        },
        font: {
          bold: true,
          color: { rgb: 'FFFFFF' },
          sz: 12
        },
        alignment: {
          horizontal: 'left',
          vertical: 'center'
        },
        border: {
          top: { style: 'medium', color: { rgb: '000000' } },
          bottom: { style: 'medium', color: { rgb: '000000' } },
          left: { style: 'medium', color: { rgb: '000000' } },
          right: { style: 'medium', color: { rgb: '000000' } }
        }
      };

      const valueInfoStyle = {
        fill: {
          fgColor: { rgb: 'D9E1F2' } // Azul muy claro
        },
        font: {
          sz: 11
        },
        alignment: {
          horizontal: 'left',
          vertical: 'center'
        },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };

      // Aplicar estilos a la hoja de información
      for (let row = rangeInfo.s.r; row <= rangeInfo.e.r; row++) {
        for (let col = rangeInfo.s.c; col <= rangeInfo.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!wsInfo[cellAddress]) continue;

          if (row === rangeInfo.s.r) {
            // Header
            wsInfo[cellAddress].s = headerInfoStyle;
          } else {
            // Valores
            wsInfo[cellAddress].s = valueInfoStyle;
          }
        }
      }

      // Calcular ancho de columnas basado en el contenido
      let maxCampoWidth = 10;
      let maxValorWidth = 10;
      
      // Recorrer todas las celdas para encontrar el ancho máximo
      for (let row = rangeInfo.s.r; row <= rangeInfo.e.r; row++) {
        for (let col = rangeInfo.s.c; col <= rangeInfo.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = wsInfo[cellAddress];
          if (cell && cell.v) {
            const cellValue = String(cell.v);
            const cellLength = cellValue.length;
            
            if (col === rangeInfo.s.c) {
              // Columna de campo
              maxCampoWidth = Math.max(maxCampoWidth, cellLength);
            } else if (col === rangeInfo.e.c) {
              // Columna de valor
              maxValorWidth = Math.max(maxValorWidth, cellLength);
            }
          }
        }
      }
      
      // Ajustar ancho de columnas con un mínimo y máximo razonable
      wsInfo['!cols'] = [
        { wch: Math.min(Math.max(maxCampoWidth + 2, 20), 50) }, // Campo (mínimo 20, máximo 50)
        { wch: Math.min(Math.max(maxValorWidth + 2, 30), 80) }  // Valor (mínimo 30, máximo 80)
      ];

      // Ajustar altura de filas
      wsInfo['!rows'] = [
        { hpt: 25 }, // Header
        ...Array(rangeInfo.e.r - rangeInfo.s.r).fill({ hpt: 20 }) // Filas de datos
      ];

      // Agregar hoja de información al workbook
      XLSX.utils.book_append_sheet(wb, wsInfo, 'Información del Período');

      // Generar nombre de archivo con rango de fechas
      let nombreArchivo = 'metricas_doctores_';
      
      if (rangoMetricas === 'todos') {
        nombreArchivo += 'historico';
      } else {
        // Calcular fechas reales del período
        let fechaInicioStr = '';
        let fechaFinStr = '';
        
        if (rangoMetricas === 'custom' && fechaInicioMetricas && fechaFinMetricas) {
          fechaInicioStr = fechaInicioMetricas.replace(/-/g, '');
          fechaFinStr = fechaFinMetricas.replace(/-/g, '');
        } else {
          // Calcular fechas para períodos predefinidos
          const fin = dateRange.fin;
          const inicio = dateRange.inicio;
          
          if (inicio) {
            fechaInicioStr = inicio.toISOString().split('T')[0].replace(/-/g, '');
          }
          fechaFinStr = fin.toISOString().split('T')[0].replace(/-/g, '');
        }
        
        if (fechaInicioStr && fechaFinStr) {
          nombreArchivo += `${fechaInicioStr}_${fechaFinStr}`;
        } else if (fechaFinStr) {
          // Si solo hay fecha fin (último día)
          nombreArchivo += fechaFinStr;
        } else {
          // Fallback
          nombreArchivo += new Date().toISOString().split('T')[0].replace(/-/g, '');
        }
      }
      
      nombreArchivo += '.xlsx';

      // Descargar archivo
      XLSX.writeFile(wb, nombreArchivo);

      toast({
        title: 'Exportación exitosa',
        description: `Se exportaron las métricas de ${metrics.length} doctor(es)`,
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
      disabled={exporting || doctors.length === 0}
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

