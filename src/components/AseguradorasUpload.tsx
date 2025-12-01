import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { consoleLogDebugger } from '@/lib/utils';

interface AseguradorasUploadProps {
  onSuccess?: () => void;
}

export function AseguradorasUpload({ onSuccess }: AseguradorasUploadProps = {} as AseguradorasUploadProps) {
  const [open, setOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Cargar Resoluciones Aseguradoras
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
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
            <Textarea
              id="resolutions"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={`EP-2024-001,Aceptada\nEP-2024-002,Rechazada\nEP-2024-003,Pendiente\nEP-2024-004,PendienteEnvio`}
              rows={10}
              className="font-mono text-sm"
              disabled={processing}
            />
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
