import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { 
  getMultipleDoctorsMetrics, 
  calculateDateRange,
  type DoctorBasicData,
  type DoctorCompleteMetrics 
} from '@/services/doctorMetricsService';

interface ExportDoctorMetricsButtonProps {
  doctors: DoctorBasicData[];
  rangoMetricas: 'todos' | '30' | '7' | '1' | 'custom';
  fechaInicioMetricas?: string;
  fechaFinMetricas?: string;
}

export function ExportDoctorMetricsButton({
  doctors,
  rangoMetricas,
  fechaInicioMetricas,
  fechaFinMetricas,
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

      // Agregar hoja al workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Métricas Doctores');

      // Generar nombre de archivo con fecha
      const fecha = new Date().toISOString().split('T')[0];
      const nombreArchivo = `metricas_doctores_${fecha}.xlsx`;

      // Descargar archivo
      XLSX.writeFile(wb, nombreArchivo);

      toast({
        title: 'Exportación exitosa',
        description: `Se exportaron las métricas de ${metrics.length} doctor(es)`,
      });
    } catch (error: any) {
      console.error('Error exportando métricas:', error);
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

