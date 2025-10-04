import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Caso {
  id: string;
  nombre_paciente: string;
  edad_paciente: number;
  sexo_paciente: string;
  email_paciente: string;
  diagnostico_principal: string;
  sintomas: string;
  historia_clinica: string;
  presion_arterial: string;
  frecuencia_cardiaca: number;
  temperatura: number;
  saturacion_oxigeno: number;
  frecuencia_respiratoria: number;
  estado: string;
}

interface Sugerencia {
  sugerencia: 'aceptar' | 'rechazar' | 'incierto';
  confianza: number;
  explicacion: string;
}

export default function VerCaso() {
  const { id } = useParams();
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [caso, setCaso] = useState<Caso | null>(null);
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [justificacion, setJustificacion] = useState('');
  const [processingDecision, setProcessingDecision] = useState(false);

  useEffect(() => {
    loadCaso();
  }, [id]);

  const loadCaso = async () => {
    if (!id) return;

    setLoading(true);
    const { data: casoData, error: casoError } = await supabase
      .from('casos')
      .select('*')
      .eq('id', id)
      .single();

    if (casoError) {
      toast({
        title: 'Error al cargar caso',
        description: casoError.message,
        variant: 'destructive',
      });
      navigate('/dashboard');
      return;
    }

    const { data: sugerenciaData } = await supabase
      .from('sugerencia_ia')
      .select('*')
      .eq('caso_id', id)
      .single();

    setCaso(casoData);
    setSugerencia(sugerenciaData);
    setLoading(false);
  };

  const handleAceptarSugerencia = () => {
    navigate(`/caso/${id}/comunicacion`);
  };

  const handleRechazarSugerencia = () => {
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!justificacion.trim()) {
      toast({
        title: 'Justificación requerida',
        description: 'Debe ingresar una justificación para rechazar la sugerencia',
        variant: 'destructive',
      });
      return;
    }

    setProcessingDecision(true);

    try {
      // Crear resolución con rechazo
      const { error: resolucionError } = await supabase
        .from('resolucion_caso')
        .insert([
          {
            caso_id: id,
            decision_medico: 'rechazado',
            comentario_medico: justificacion,
            fecha_decision_medico: new Date().toISOString(),
          },
        ]);

      if (resolucionError) throw resolucionError;

      // Actualizar estado del caso a derivado
      const { error: updateError } = await supabase
        .from('casos')
        .update({ estado: 'derivado' })
        .eq('id', id);

      if (updateError) throw updateError;

      toast({
        title: 'Caso derivado',
        description: 'El caso ha sido derivado al pool de médicos jefe',
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Error al procesar decisión',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingDecision(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando caso...</p>
      </div>
    );
  }

  if (!caso || !sugerencia) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Caso no encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-gradient-to-r from-primary to-secondary text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-2xl font-bold">Resultado del Análisis</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* Datos del Paciente */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{caso.nombre_paciente}</CardTitle>
                <CardDescription>
                  {caso.edad_paciente} años • {caso.sexo_paciente === 'M' ? 'Masculino' : caso.sexo_paciente === 'F' ? 'Femenino' : 'Otro'}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/caso/${id}/editar`)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar datos
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Diagnóstico Principal</p>
              <p className="text-base">{caso.diagnostico_principal}</p>
            </div>
            {caso.sintomas && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Síntomas</p>
                <p className="text-base">{caso.sintomas}</p>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t">
              {caso.presion_arterial && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">PA</p>
                  <p className="text-base">{caso.presion_arterial}</p>
                </div>
              )}
              {caso.frecuencia_cardiaca && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">FC</p>
                  <p className="text-base">{caso.frecuencia_cardiaca} lpm</p>
                </div>
              )}
              {caso.temperatura && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Temp</p>
                  <p className="text-base">{caso.temperatura}°C</p>
                </div>
              )}
              {caso.saturacion_oxigeno && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">SpO₂</p>
                  <p className="text-base">{caso.saturacion_oxigeno}%</p>
                </div>
              )}
              {caso.frecuencia_respiratoria && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">FR</p>
                  <p className="text-base">{caso.frecuencia_respiratoria} rpm</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resultado IA */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Sugerencia de IA</CardTitle>
              <Badge
                variant={sugerencia.sugerencia === 'aceptar' ? 'default' : 'destructive'}
                className="text-base px-4 py-1"
              >
                {sugerencia.sugerencia === 'aceptar' ? (
                  <CheckCircle className="w-4 h-4 mr-2" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                {sugerencia.sugerencia === 'aceptar' ? 'Aplica Ley de Urgencia' : 'No Aplica Ley de Urgencia'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Nivel de Confianza</p>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all"
                    style={{ width: `${sugerencia.confianza}%` }}
                  />
                </div>
                <span className="text-xl font-bold text-primary">{sugerencia.confianza}%</span>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium mb-2">Explicación del Análisis</p>
                  <p className="text-sm text-muted-foreground">{sugerencia.explicacion}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Acciones */}
        <Card>
          <CardHeader>
            <CardTitle>Decisión del Médico</CardTitle>
            <CardDescription>
              Revise la sugerencia de IA y tome una decisión sobre el caso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                size="lg"
                onClick={handleAceptarSugerencia}
                className="w-full"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Aceptar Sugerencia
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleRechazarSugerencia}
                className="w-full border-destructive text-destructive hover:bg-destructive hover:text-white"
              >
                <XCircle className="w-5 h-5 mr-2" />
                Rechazar Sugerencia
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Modal de Rechazo */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Sugerencia de IA</DialogTitle>
            <DialogDescription>
              Al rechazar la sugerencia, el caso será derivado automáticamente al pool de médicos jefe.
              Por favor, ingrese una justificación.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="justificacion">Justificación del Rechazo *</Label>
              <Textarea
                id="justificacion"
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                rows={4}
                placeholder="Explique las razones por las cuales rechaza la sugerencia de IA..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={processingDecision}
            >
              {processingDecision ? 'Procesando...' : 'Confirmar Rechazo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
