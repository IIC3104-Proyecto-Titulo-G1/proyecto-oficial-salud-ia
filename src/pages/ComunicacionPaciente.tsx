import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Mail, Send } from 'lucide-react';

interface Caso {
  id: string;
  nombre_paciente: string;
  email_paciente: string;
  diagnostico_principal: string;
}

interface Sugerencia {
  sugerencia: 'aceptar' | 'rechazar' | 'incierto';
  explicacion: string;
}

export default function ComunicacionPaciente() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [caso, setCaso] = useState<Caso | null>(null);
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [emailPaciente, setEmailPaciente] = useState('');
  const [comentarioAdicional, setComentarioAdicional] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    const { data: casoData } = await supabase
      .from('casos')
      .select('id, nombre_paciente, email_paciente, diagnostico_principal')
      .eq('id', id)
      .single();

    const { data: sugerenciaData } = await supabase
      .from('sugerencia_ia')
      .select('sugerencia, explicacion')
      .eq('caso_id', id)
      .single();

    if (casoData) {
      setCaso(casoData);
      setEmailPaciente(casoData.email_paciente);
    }
    setSugerencia(sugerenciaData);
    setLoading(false);
  };

  const handleEnviar = async (enviar: boolean) => {
    setSending(true);

    try {
      // Verificar si ya existe una resolución previa
      const { data: resolucionExistente } = await supabase
        .from('resolucion_caso')
        .select('*')
        .eq('caso_id', id)
        .single();

      if (resolucionExistente) {
        // Si ya existe, actualizar la resolución
        const { error: updateResolucionError } = await supabase
          .from('resolucion_caso')
          .update({
            decision_final: 'aceptado',
            comentario_final: comentarioAdicional,
            fecha_decision_medico_jefe: new Date().toISOString(),
          })
          .eq('caso_id', id);

        if (updateResolucionError) throw updateResolucionError;
      } else {
        // Si no existe, crear nueva resolución
        const { error: resolucionError } = await supabase
          .from('resolucion_caso')
          .insert([
            {
              caso_id: id,
              decision_medico: 'aceptado',
              comentario_medico: comentarioAdicional,
              decision_final: 'aceptado',
              comentario_final: comentarioAdicional,
              fecha_decision_medico: new Date().toISOString(),
            },
          ]);

        if (resolucionError) throw resolucionError;
      }

      // Actualizar estado del caso a aceptado
      const { error: updateError } = await supabase
        .from('casos')
        .update({ estado: 'aceptado' })
        .eq('id', id);

      if (updateError) throw updateError;

      // Registrar comunicación
      const { error: comunicacionError } = await supabase
        .from('comunicaciones_paciente')
        .insert([
          {
            caso_id: id,
            resultado: sugerencia?.sugerencia === 'aceptar' ? 'aceptado' : 'rechazado',
            explicacion: `${sugerencia?.explicacion}\n\n${comentarioAdicional}`,
            enviada: enviar,
            fecha_envio: enviar ? new Date().toISOString() : null,
          },
        ]);

      if (comunicacionError) throw comunicacionError;

      toast({
        title: enviar ? 'Comunicación enviada' : 'Caso registrado',
        description: enviar
          ? 'El correo ha sido enviado al paciente exitosamente'
          : 'El caso ha sido registrado sin enviar comunicación',
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Error al procesar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  if (loading || !caso || !sugerencia) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  const resultado = sugerencia.sugerencia === 'aceptar' ? 'ACTIVADA' : 'NO ACTIVADA';
  const resultadoColor = sugerencia.sugerencia === 'aceptar' ? 'text-crm' : 'text-destructive';

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-gradient-to-r from-crm to-crm/80 text-white shadow-lg border-b border-crm/40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/caso/${id}`)}
              className="text-white hover:bg-white/15"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-2xl font-bold">Comunicación al Paciente</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos de Envío</CardTitle>
            <CardDescription>
              Revise y modifique si es necesario el destinatario del correo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email del Paciente</Label>
              <Input
                id="email"
                type="email"
                value={emailPaciente}
                onChange={(e) => setEmailPaciente(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-crm/30">
          <CardHeader>
            <div className="flex items-center gap-2 text-crm">
              <Mail className="w-5 h-5" />
              <CardTitle>Previsualización del Correo</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="bg-white rounded-lg p-6 space-y-4">
            <div className="border-b pb-4">
              <p className="text-sm text-muted-foreground">Para:</p>
              <p className="font-medium">{emailPaciente}</p>
            </div>

            <div className="border-b pb-4">
              <p className="text-sm text-muted-foreground mb-1">Asunto:</p>
              <p className="font-medium">Resultado de Evaluación - Ley de Urgencia</p>
            </div>

            <div className="space-y-4 pt-2">
              <p className="text-crm font-medium">Estimado/a {caso.nombre_paciente},</p>

              <p>
                Por medio del presente, le informamos el resultado de la evaluación de su caso clínico
                bajo la Ley de Urgencia (Decreto 34).
              </p>

              <div className={`bg-muted/50 rounded-lg p-4 border-l-4 ${
                sugerencia.sugerencia === 'aceptar' ? 'border-success' : 'border-destructive'
              }`}>
                <p className="font-semibold text-lg mb-2">
                  Resultado: <span className={resultadoColor}>LEY DE URGENCIA {resultado}</span>
                </p>
                <p className="text-sm">
                  <strong>Diagnóstico:</strong> {caso.diagnostico_principal}
                </p>
              </div>

              <div>
                <p className="font-semibold mb-2">Fundamento Legal:</p>
                <p className="text-sm text-muted-foreground">
                  Según lo establecido en el Decreto 34, que regula la Ley de Urgencia en Chile, se ha
                  evaluado su condición médica bajo los criterios establecidos en dicha normativa.
                </p>
              </div>

              <div>
                <p className="font-semibold mb-2">Explicación del Análisis:</p>
                <p className="text-sm text-muted-foreground">{sugerencia.explicacion}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comentario">Comentario Adicional del Médico (Opcional)</Label>
                <Textarea
                  id="comentario"
                  value={comentarioAdicional}
                  onChange={(e) => setComentarioAdicional(e.target.value)}
                  rows={4}
                  placeholder="Agregue cualquier comentario o aclaración adicional para el paciente..."
                />
              </div>

              {comentarioAdicional && (
                <div>
                  <p className="font-semibold mb-2">Comentario del Médico Tratante:</p>
                  <p className="text-sm text-muted-foreground">{comentarioAdicional}</p>
                </div>
              )}

              <p className="text-sm">
                Ante cualquier duda o consulta, no dude en contactarnos.
              </p>

              <p className="text-sm">
                Atentamente,<br />
                <strong>Equipo Médico - SaludIA</strong>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
            <CardDescription>
              Elija cómo desea proceder con la comunicación al paciente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                size="lg"
                onClick={() => handleEnviar(true)}
                disabled={sending}
                className="w-full"
              >
                <Send className="w-5 h-5 mr-2" />
                {sending ? 'Enviando...' : 'Confirmar y Enviar Correo'}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => handleEnviar(false)}
                disabled={sending}
                className="w-full"
              >
                Registrar sin Enviar
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
