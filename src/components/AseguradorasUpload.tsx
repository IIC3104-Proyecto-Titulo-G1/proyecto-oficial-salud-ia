import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { consoleLogDebugger } from '@/lib/utils';
import * as XLSX from 'xlsx';

interface AseguradorasUploadProps {
  onSuccess?: () => void;
}

export function AseguradorasUpload({ onSuccess }: AseguradorasUploadProps = {} as AseguradorasUploadProps) {
  const [open, setOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Prevenir auto-focus cuando se abre el modal
  useEffect(() => {
    if (open && textareaRef.current) {
      // Pequeño delay para asegurar que el modal esté completamente renderizado
      setTimeout(() => {
        if (textareaRef.current && document.activeElement === textareaRef.current) {
          textareaRef.current.blur();
        }
      }, 100);
    }
  }, [open]);

  const processResolutions = async (input: string) => {
    setProcessing(true);
    try {
      // Parsear el input
      const lines = input.trim().split('\n').filter(line => line.trim());
      const updates: { episodio: string; resolucion: string }[] = [];
      const errors: string[] = [];

      lines.forEach((line, index) => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length !== 2) {
          errors.push(`Línea ${index + 1}: formato inválido`);
          return;
        }

        const [episodio, resolucion] = parts;
        const resolucionNormalizada = resolucion.toLowerCase().trim();

        // Normalizar diferentes variantes de "pendiente envio" a "pendiente_envio"
        let resolucionFinal = resolucionNormalizada;
        if (resolucionNormalizada === 'pendiente envio' || 
            resolucionNormalizada === 'pendiente envío' || 
            resolucionNormalizada === 'pendiente_envio' ||
            resolucionNormalizada === 'pendienteenvio' ||
            resolucionNormalizada === 'pendiente-envio' ||
            resolucionNormalizada === 'pendiente-envío' ||
            resolucionNormalizada === 'pendienteenvio') {
          resolucionFinal = 'pendiente_envio';
        } else if (resolucionNormalizada === 'pendiente' || 
                   resolucionNormalizada === 'pendiente resolucion' || 
                   resolucionNormalizada === 'pendiente resolución' ||
                   resolucionNormalizada === 'pendienteresolucion' ||
                   resolucionNormalizada === 'pendiente-resolucion' ||
                   resolucionNormalizada === 'pendiente-resolución') {
          resolucionFinal = 'pendiente';
        }
        
        if (resolucionFinal !== 'aceptada' && resolucionFinal !== 'rechazada' && resolucionFinal !== 'pendiente' && resolucionFinal !== 'pendiente_envio') {
          errors.push(`Línea ${index + 1}: resolución debe ser "Aceptada", "Rechazada", "Pendiente" o "PendienteEnvio"`);
          return;
        }

        updates.push({ episodio, resolucion: resolucionFinal });
      });

      if (errors.length > 0) {
        toast({
          title: 'Errores de formato',
          description: errors.join(', '),
          variant: 'destructive',
        });
        setProcessing(false);
        return;
      }

      // Actualizar cada caso en la base de datos
      let successCount = 0;
      let notFoundCount = 0;
      const notFoundEpisodios: string[] = [];
      const errorEpisodios: string[] = [];

      for (const update of updates) {
        consoleLogDebugger(`Buscando casos con episodio: ${update.episodio}`);
        
        // Buscar todos los casos con el mismo episodio que estén en estado aceptado
        const { data: casosAceptados, error: fetchAllError } = await supabase
          .from('casos')
          .select('id, estado, prevision, episodio')
          .eq('episodio', update.episodio)
          .eq('estado', 'aceptado');

        if (fetchAllError) {
          consoleLogDebugger(`Error buscando casos ${update.episodio}:`, fetchAllError);
          errorEpisodios.push(update.episodio);
          continue;
        }

        if (!casosAceptados || casosAceptados.length === 0) {
          consoleLogDebugger(`No se encontraron casos en estado 'aceptado' con episodio ${update.episodio}`);
          notFoundCount++;
          notFoundEpisodios.push(update.episodio);
          continue;
        }

        consoleLogDebugger(`Encontrados ${casosAceptados.length} caso(s) en estado 'aceptado' con episodio ${update.episodio}`);
        consoleLogDebugger(`Actualizando todos los casos con resolución: ${update.resolucion}`);
        
        // Actualizar TODOS los casos con el mismo episodio que estén en estado aceptado
        const idsParaActualizar = casosAceptados.map(c => c.id);
        consoleLogDebugger(`IDs de casos a actualizar:`, idsParaActualizar);
        
        const { data: updatedCases, error: updateError } = await supabase
          .from('casos')
          .update({ 
            estado_resolucion_aseguradora: update.resolucion 
          })
          .in('id', idsParaActualizar)
          .select('id, estado_resolucion_aseguradora, episodio');

        if (updateError) {
          consoleLogDebugger(`Error actualizando casos ${update.episodio}:`, updateError);
          consoleLogDebugger(`Detalles del error:`, {
            message: updateError.message,
            code: updateError.code,
            details: updateError.details,
            hint: updateError.hint
          });
          errorEpisodios.push(`${update.episodio} (${updateError.message})`);
        } else {
          consoleLogDebugger(`${updatedCases?.length || 0} caso(s) con episodio ${update.episodio} actualizado(s) exitosamente:`, updatedCases);
          if (updatedCases && updatedCases.length > 0) {
            updatedCases.forEach((c, idx) => {
              consoleLogDebugger(`  Caso ${idx + 1} - ID: ${c.id}, Valor guardado: ${c.estado_resolucion_aseguradora}`);
              if (c.estado_resolucion_aseguradora !== update.resolucion) {
                consoleLogDebugger(`  ⚠️ ADVERTENCIA: El valor guardado (${c.estado_resolucion_aseguradora}) no coincide con el esperado (${update.resolucion})`);
              }
            });
          }
          successCount += updatedCases?.length || 0;
        }
      }

      let description = `${successCount} casos actualizados.`;
      if (notFoundCount > 0) {
        description += ` ${notFoundCount} no encontrados o no están en estado 'aceptado': ${notFoundEpisodios.join(', ')}.`;
      }
      if (errorEpisodios.length > 0) {
        description += ` Errores en: ${errorEpisodios.join(', ')}.`;
      }

      toast({
        title: 'Proceso completado',
        description: description,
      });

      setTextInput('');
      setOpen(false);
      
      // Esperar un momento para asegurar que los updates se completen y se propaguen
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Llamar callback si existe para recargar los casos
      if (onSuccess) {
        consoleLogDebugger('Ejecutando callback onSuccess para recargar casos...');
        // Forzar recarga llamando dos veces con un pequeño delay para asegurar que se actualice
        onSuccess();
        await new Promise(resolve => setTimeout(resolve, 300));
        onSuccess();
      } else {
        consoleLogDebugger('⚠️ No se proporcionó callback onSuccess. Los casos no se recargarán automáticamente.');
      }
    } catch (error: any) {
      toast({
        title: 'Error al procesar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = async () => {
    if (!textInput.trim()) {
      toast({
        title: 'Campo vacío',
        description: 'Ingrese los datos en el formato indicado',
        variant: 'destructive',
      });
      return;
    }

    await processResolutions(textInput);
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor seleccione un archivo Excel (.xlsx o .xls)',
        variant: 'destructive',
      });
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Obtener la primera hoja
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length === 0) {
        toast({
          title: 'Archivo vacío',
          description: 'El archivo Excel no contiene datos',
          variant: 'destructive',
        });
        return;
      }

      // Buscar las columnas "Episodio" y "Validación" en la primera fila
      const headerRow = jsonData[0] || [];
      let episodioColIndex = -1;
      let validacionColIndex = -1;

      headerRow.forEach((cell, index) => {
        const cellValue = String(cell || '').trim();
        if (cellValue.toLowerCase() === 'episodio' || cellValue.toLowerCase() === 'episode') {
          episodioColIndex = index;
        }
        if (cellValue.toLowerCase() === 'validación' || 
            cellValue.toLowerCase() === 'validacion' || 
            cellValue.toLowerCase() === 'validación' ||
            cellValue.toLowerCase() === 'validation') {
          validacionColIndex = index;
        }
      });

      // Verificar que se encontraron las columnas
      const columnasFaltantes: string[] = [];
      if (episodioColIndex === -1) {
        columnasFaltantes.push('Episodio');
      }
      if (validacionColIndex === -1) {
        columnasFaltantes.push('Validación');
      }

      if (columnasFaltantes.length > 0) {
        toast({
          title: 'Columnas no encontradas',
          description: `Las columnas ${columnasFaltantes.join(' y ')} no fueron encontradas en el archivo Excel`,
          variant: 'destructive',
        });
        return;
      }

      // Extraer datos y convertir a formato texto
      const lines: string[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        const episodio = String(row[episodioColIndex] || '').trim();
        const validacion = String(row[validacionColIndex] || '').trim();

        if (episodio && validacion) {
          // Traducir PERTINENTE/NO PERTINENTE a Aceptada/Rechazada
          let resolucion = validacion;
          const validacionUpper = validacion.toUpperCase();
          if (validacionUpper === 'PERTINENTE') {
            resolucion = 'Aceptada';
          } else if (validacionUpper === 'NO PERTINENTE' || validacionUpper === 'NO PERTINENTE') {
            resolucion = 'Rechazada';
          }

          lines.push(`${episodio},${resolucion}`);
        }
      }

      if (lines.length === 0) {
        toast({
          title: 'Sin datos válidos',
          description: 'No se encontraron filas con datos válidos en el archivo Excel',
          variant: 'destructive',
        });
        return;
      }

      // Poner los datos en el textarea
      setTextInput(lines.join('\n'));

      toast({
        title: 'Archivo procesado',
        description: `Se cargaron ${lines.length} registro(s) desde el archivo Excel`,
      });
    } catch (error: any) {
      consoleLogDebugger('Error procesando archivo Excel:', error);
      toast({
        title: 'Error al procesar archivo',
        description: error.message || 'Ocurrió un error al leer el archivo Excel',
        variant: 'destructive',
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
    // Resetear el input para permitir seleccionar el mismo archivo nuevamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90">
          <FileSpreadsheet className="h-4 w-4" />
          Cargar Resoluciones Aseguradoras
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="max-w-2xl"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Cargar Pertinencia/Resolución de Aseguradoras</DialogTitle>
          <DialogDescription>
            Ingrese los datos en el siguiente formato (un caso por línea):
            <br />
            <code className="text-xs bg-muted p-1 rounded mt-2 block">
              episodio,Aceptada
              <br />
              episodio2,Rechazada
              <br />
              episodio3,Pendiente
              <br />
              episodio4,PendienteEnvio
            </code>
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Upload className="h-4 w-4" />
            <AlertDescription>
            Solo se actualizarán casos que estén en estado "Aceptado" (Ley aplicada).
            La resolución puede ser: <strong>Aceptada</strong>, <strong>Rechazada</strong>, <strong>Pendiente</strong> o <strong>PendienteEnvio</strong>.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resolutions">Datos de Resoluciones</Label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-lg transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <Textarea
                ref={textareaRef}
                id="resolutions"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={`EP-2024-001,Aceptada\nEP-2024-002,Rechazada\nEP-2024-003,Pendiente\nEP-2024-004,PendienteEnvio`}
                rows={10}
                className="font-mono text-sm border-0 focus-visible:ring-0"
                disabled={processing}
                tabIndex={-1}
                onFocus={(e) => {
                  // Prevenir que se seleccione el texto al hacer focus
                  e.target.setSelectionRange(e.target.value.length, e.target.value.length);
                }}
              />
              {isDragging && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg pointer-events-none">
                  <p className="text-primary font-medium">Suelta el archivo Excel aquí</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInputChange}
                className="hidden"
                id="excel-file-input"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Seleccionar archivo Excel
              </Button>
              <p className="text-xs text-muted-foreground">
                O arrastra y suelta un archivo Excel aquí
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setTextInput('');
                setOpen(false);
              }}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={processing}>
              {processing ? 'Procesando...' : 'Cargar Resoluciones'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
