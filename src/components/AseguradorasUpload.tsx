import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
        const resolucionNormalizada = resolucion.toLowerCase();

        if (resolucionNormalizada !== 'aceptada' && resolucionNormalizada !== 'rechazada') {
          errors.push(`Línea ${index + 1}: resolución debe ser "Aceptada" o "Rechazada"`);
          return;
        }

        updates.push({ episodio, resolucion: resolucionNormalizada });
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

      for (const update of updates) {
        const { data: casos, error: fetchError } = await supabase
          .from('casos')
          .select('id, estado, prevision')
          .eq('episodio', update.episodio)
          .eq('estado', 'aceptado');

        if (fetchError) {
          console.error(`Error buscando caso ${update.episodio}:`, fetchError);
          continue;
        }

        if (!casos || casos.length === 0) {
          notFoundCount++;
          continue;
        }

        // Actualizar el caso
        const { error: updateError } = await supabase
          .from('casos')
          .update({ 
            estado_resolucion_aseguradora: update.resolucion 
          })
          .eq('id', casos[0].id);

        if (updateError) {
          console.error(`Error actualizando caso ${update.episodio}:`, updateError);
        } else {
          successCount++;
        }
      }

      toast({
        title: 'Proceso completado',
        description: `${successCount} casos actualizados. ${notFoundCount > 0 ? `${notFoundCount} no encontrados o no aplicables.` : ''}`,
      });

      setTextInput('');
      setOpen(false);
      
      // Llamar callback si existe
      if (onSuccess) {
        onSuccess();
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
            </code>
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Upload className="h-4 w-4" />
          <AlertDescription>
            Solo se actualizarán casos que estén en estado "Aceptado" (Ley aplicada).
            La resolución puede ser: <strong>Aceptada</strong> o <strong>Rechazada</strong>.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resolutions">Datos de Resoluciones</Label>
            <Textarea
              id="resolutions"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={`EP-2024-001,Aceptada\nEP-2024-002,Rechazada\nEP-2024-003,Aceptada`}
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
