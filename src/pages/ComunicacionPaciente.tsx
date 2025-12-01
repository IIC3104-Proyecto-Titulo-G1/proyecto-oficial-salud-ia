import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft, Mail, Send } from 'lucide-react';
import { consoleLogDebugger } from '@/lib/utils';

interface Caso {
  id: string;
  nombre_paciente: string;
  email_paciente: string;
  diagnostico_principal: string;
  estado: string;
  medico_jefe_id?: string;
  prevision?: string;
  estado_resolucion_aseguradora?: string;
}

interface Sugerencia {
  sugerencia: 'aceptar' | 'rechazar' | 'incierto';
  explicacion: string;
}

export default function ComunicacionPaciente() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [caso, setCaso] = useState<Caso | null>(null);
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [emailPaciente, setEmailPaciente] = useState('');
  const [comentarioAdicional, setComentarioAdicional] = useState('');
  // Leer la acción desde los parámetros de la URL (aceptar/rechazar)
  const accionMedico = (searchParams.get('accion') as 'aceptar' | 'rechazar') || 'aceptar';
  // Leer la decisión real del médico (aplicar/rechazar) - esto se usa cuando editan y presionan un botón
  const decisionMedico = searchParams.get('decision') as 'aplicar' | 'rechazar' | null;

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Cargar datos en paralelo
      const [casoResult, sugerenciaResult, resolucionResult] = await Promise.all([
        supabase
      .from('casos')
          .select('id, nombre_paciente, email_paciente, diagnostico_principal, estado, medico_jefe_id, prevision, estado_resolucion_aseguradora')
      .eq('id', id)
          .single(),
        supabase
      .from('sugerencia_ia')
      .select('sugerencia, explicacion')
      .eq('caso_id', id)
      .order('fecha_procesamiento', { ascending: false })
      .limit(1)
          .maybeSingle(),
        supabase
      .from('resolucion_caso')
          .select('comentario_email, email_paciente_enviado')
      .eq('caso_id', id)
          .maybeSingle()
      ]);

      const casoData = casoResult.data;
      const sugerenciaData = sugerenciaResult.data;
      const resolucionData = resolucionResult.data;

    if (casoData) {
      setCaso(casoData);
        // Prioridad: 1) email del último correo enviado, 2) email del paciente del caso
        const emailAMostrar = resolucionData?.email_paciente_enviado 
          ? resolucionData.email_paciente_enviado 
          : casoData.email_paciente;
        setEmailPaciente(emailAMostrar);
        consoleLogDebugger('Email cargado:', {
          email_paciente_enviado: resolucionData?.email_paciente_enviado,
          email_paciente: casoData.email_paciente,
          email_seleccionado: emailAMostrar
        });
    }
    setSugerencia(sugerenciaData);
    
    // Precargar comentario del email si existe
    if (resolucionData?.comentario_email) {
      setComentarioAdicional(resolucionData.comentario_email);
    }
    } catch (error) {
      consoleLogDebugger('Error cargando datos:', error);
    } finally {
    setLoading(false);
    }
  };

  const handleEnviar = async (enviar: boolean) => {
    setSending(true);

    try {
      // Obtener el caso para verificar su estado
      const { data: casoActual } = await supabase
        .from('casos')
        .select('estado, medico_jefe_id, medico_tratante_id')
        .eq('id', id)
        .single();

      // Si es médico jefe y el caso no tiene medico_jefe_id asignado, asignarlo
      if (userRole === 'medico_jefe' && !casoActual.medico_jefe_id) {
        const { error: assignError } = await supabase
          .from('casos')
          .update({ medico_jefe_id: user?.id })
          .eq('id', id);

        if (assignError) throw assignError;
      }

      // Determinar el resultado final basado en:
      // 1. Si hay decisionMedico (el médico presionó "Aplicar Ley" o "No Aplicar Ley")
      // 2. Si el caso ya está cerrado, usar el estado del caso
      // 3. Si no, usar la acción del médico y sugerencia de IA
      let resultadoFinal: 'aceptado' | 'rechazado';
      
      if (decisionMedico) {
        // El médico acaba de presionar un botón de decisión
        resultadoFinal = decisionMedico === 'aplicar' ? 'aceptado' : 'rechazado';
      } else if (casoActual.estado === 'aceptado' || casoActual.estado === 'rechazado') {
        // Caso cerrado: usar el estado del caso (cuando presionan "Enviar Correo" sin nueva decisión)
        resultadoFinal = casoActual.estado as 'aceptado' | 'rechazado';
      } else {
        // Caso abierto: determinar basado en la acción del médico y la sugerencia de IA
        if (accionMedico === 'aceptar') {
          // Médico acepta la sugerencia de IA
          resultadoFinal = sugerencia?.sugerencia === 'aceptar' ? 'aceptado' : 'rechazado';
        } else {
          // Médico rechaza la sugerencia de IA (hace lo opuesto)
          resultadoFinal = sugerencia?.sugerencia === 'aceptar' ? 'rechazado' : 'aceptado';
        }
      }
      const estadoFinal = resultadoFinal;

      // Verificar si ya existe una resolución previa
      const { data: resolucionExistente } = await supabase
        .from('resolucion_caso')
        .select('*')
        .eq('caso_id', id)
        .maybeSingle();

      if (resolucionExistente) {
        // Actualizar comentario del email y email usado
        consoleLogDebugger('Actualizando resolución existente con email:', emailPaciente.trim());
        const { data: updateData, error: updateResolucionError } = await supabase
          .from('resolucion_caso')
          .update({
            comentario_email: comentarioAdicional.trim() || null,
            email_paciente_enviado: emailPaciente.trim() || null,
          })
          .eq('caso_id', id)
          .select();

        if (updateResolucionError) {
          consoleLogDebugger('Error al actualizar resolución:', updateResolucionError);
          throw updateResolucionError;
        }
        consoleLogDebugger('Resolución actualizada:', updateData);
      } else {
        // Crear nueva resolución
        const insertData: any = {
          caso_id: id,
          decision_medico: resultadoFinal,
          comentario_email: comentarioAdicional.trim() || null,
          email_paciente_enviado: emailPaciente.trim() || null,
          fecha_decision_medico: new Date().toISOString(),
        };

        if (userRole === 'medico_jefe') {
          insertData.decision_final = resultadoFinal;
          insertData.fecha_decision_medico_jefe = new Date().toISOString();
        } else {
          insertData.decision_final = resultadoFinal;
        }

        consoleLogDebugger('Insertando nueva resolución con email:', emailPaciente.trim());
        consoleLogDebugger('Datos a insertar:', insertData);
        const { data: insertResult, error: resolucionError } = await supabase
          .from('resolucion_caso')
          .insert([insertData])
          .select();

        if (resolucionError) {
          consoleLogDebugger('Error al insertar resolución:', resolucionError);
          throw resolucionError;
        }
        consoleLogDebugger('Resolución insertada:', insertResult);
      }

      // Actualizar estado del caso si:
      // 1. Se tomó una nueva decisión (decisionMedico existe), O
      // 2. El caso no está cerrado
      // Nota: El trigger de la base de datos se encarga automáticamente de crear la notificación
      // cuando el estado cambia a 'aceptado' o 'rechazado'
      if (decisionMedico || (casoActual.estado !== 'aceptado' && casoActual.estado !== 'rechazado')) {
        const { error: updateError } = await supabase
          .from('casos')
          .update({ estado: estadoFinal })
          .eq('id', id);

        if (updateError) throw updateError;
      }

      // Si se debe enviar el correo, llamar al edge function
      if (enviar) {
        const resultadoEmail = resultadoFinal;
        
        const { data: emailData, error: emailError } = await supabase.functions.invoke(
          'send-patient-email',
          {
            body: {
              to: emailPaciente,
              patientName: caso!.nombre_paciente,
              diagnosis: caso!.diagnostico_principal,
              result: resultadoEmail,
              explanation: sugerencia?.explicacion || '',
              additionalComment: comentarioAdicional || undefined,
              // Normalizar pendiente_envio a pendiente para el email
              insuranceStatus: (caso as any).estado_resolucion_aseguradora === 'pendiente_envio' 
                ? 'pendiente' 
                : ((caso as any).estado_resolucion_aseguradora || null),
              insuranceType: (caso as any).prevision || null,
            },
          }
        );

        if (emailError) {
          consoleLogDebugger('Error al enviar correo:', emailError);
          throw new Error('Error al conectar con el servicio de correo');
        }

        // Verificar si Resend rechazó el envío
        if (emailData && !emailData.success) {
          consoleLogDebugger('Resend error:', emailData.error);
          throw new Error(
            'Resend requiere verificar un dominio. Por ahora solo puedes enviar correos de prueba a: tallerintegraciong1@gmail.com'
          );
        }

        consoleLogDebugger('Email enviado:', emailData);
      }

      // Registrar comunicación
      const resultadoComunicacion = resultadoFinal;
      
      const { error: comunicacionError } = await supabase
        .from('comunicaciones_paciente')
        .insert([
          {
            caso_id: id,
            resultado: resultadoComunicacion,
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

      // Redirigir según el rol del usuario
      if (userRole === 'admin') {
        navigate('/admin?tab=casos');
      } else {
      navigate('/dashboard');
      }
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


  if (loading || !caso) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  // Determinar el resultado para mostrar en la previsualización
  let resultado: string;
  
  if (decisionMedico) {
    // Si hay una decisión nueva del médico, usarla
    resultado = decisionMedico === 'aplicar' ? 'ACTIVADA' : 'NO ACTIVADA';
  } else if (caso.estado === 'aceptado' || caso.estado === 'rechazado') {
    // Si el caso ya está cerrado, usar el estado del caso
    resultado = caso.estado === 'aceptado' ? 'ACTIVADA' : 'NO ACTIVADA';
  } else if (sugerencia) {
    // Si no está cerrado, calcular basado en acción y sugerencia
    if (accionMedico === 'aceptar') {
      resultado = sugerencia.sugerencia === 'aceptar' ? 'ACTIVADA' : 'NO ACTIVADA';
    } else {
      resultado = sugerencia.sugerencia === 'aceptar' ? 'NO ACTIVADA' : 'ACTIVADA';
    }
  } else {
    // Fallback si no hay sugerencia
    resultado = 'NO ACTIVADA';
  }
  
  const resultadoColor = resultado === 'ACTIVADA' ? 'text-crm' : 'text-destructive';

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

              {/* Decisión Médica y Estado de Aseguradora (solo cuando se activó la ley) */}
              {resultado === 'ACTIVADA' && (
                <div className="bg-muted/50 rounded-lg p-4 border-l-4 border-success space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Decisión Médica:</p>
                    <p className="font-bold text-2xl mb-2">
                      <span className={resultadoColor}>LEY DE URGENCIA {resultado}</span>
                </p>
                <p className="text-sm">
                  <strong>Diagnóstico:</strong> {caso.diagnostico_principal}
                </p>
              </div>

                  {/* Estado de Aseguradora */}
                  {(caso as any).prevision && (caso as any).estado_resolucion_aseguradora && (
                    <>
                      <div className="pt-4 border-t border-border/50">
                        <p className="text-sm text-muted-foreground mb-2">Estado de Aseguradora:</p>
                        <p className={`font-bold text-2xl ${
                          (caso as any).estado_resolucion_aseguradora === 'aceptada' 
                            ? 'text-success' 
                            : (caso as any).estado_resolucion_aseguradora === 'rechazada' 
                            ? 'text-destructive' 
                            : 'text-yellow-600'
                        }`}>
                          {(caso as any).estado_resolucion_aseguradora === 'pendiente' || (caso as any).estado_resolucion_aseguradora === 'pendiente_envio'
                            ? `PENDIENTE RESOLUCIÓN ${(caso as any).prevision?.toUpperCase()}` 
                            : (caso as any).estado_resolucion_aseguradora === 'aceptada' 
                            ? `ACEPTADO POR ${(caso as any).prevision?.toUpperCase()}` 
                            : `RECHAZADO POR ${(caso as any).prevision?.toUpperCase()}`}
                        </p>
                      </div>
                      
                      {/* Nota sobre aprobación de aseguradora */}
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                          <p className="text-sm text-yellow-900 leading-relaxed">
                            <strong>Importante:</strong>{' '}
                            {(caso as any).estado_resolucion_aseguradora === 'aceptada' 
                              ? `Su aseguradora (${(caso as any).prevision}) ha aprobado la decisión médica. La Ley de Urgencia está activa y en pleno efecto.`
                              : (caso as any).estado_resolucion_aseguradora === 'rechazada'
                              ? `Su aseguradora (${(caso as any).prevision}) ha rechazado la decisión médica. La Ley de Urgencia no se activará. Por favor, contacte con su aseguradora para más información sobre su caso.`
                              : (caso as any).estado_resolucion_aseguradora === 'pendiente' || (caso as any).estado_resolucion_aseguradora === 'pendiente_envio'
                              ? `Para que la Ley de Urgencia se active definitivamente, su aseguradora (${(caso as any).prevision}) debe aprobar esta decisión médica. La activación definitiva de la ley está sujeta a la aprobación de ${(caso as any).prevision}.`
                              : `Para que la Ley de Urgencia se active definitivamente, su aseguradora (${(caso as any).prevision}) debe aprobar esta decisión médica. La activación definitiva de la ley está sujeta a la aprobación de ${(caso as any).prevision}.`
                            }
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Decisión Médica (solo cuando NO se activó la ley) */}
              {resultado !== 'ACTIVADA' && (
                <div className={`bg-muted/50 rounded-lg p-4 border-l-4 border-destructive`}>
                  <p className="text-sm text-muted-foreground mb-2">Decisión Médica:</p>
                  <p className="font-bold text-2xl mb-2">
                    <span className={resultadoColor}>LEY DE URGENCIA {resultado}</span>
                  </p>
                  <p className="text-sm">
                    <strong>Diagnóstico:</strong> {caso.diagnostico_principal}
                  </p>
                </div>
              )}

              <div>
                <p className="font-semibold mb-2">Fundamento Legal:</p>
                <p className="text-sm text-muted-foreground">
                  Según lo establecido en el Decreto 34, que regula la Ley de Urgencia en Chile, se ha
                  evaluado su condición médica bajo los criterios establecidos en dicha normativa.
                </p>
              </div>

              <div>
                <p className="font-semibold mb-2">Explicación del Análisis:</p>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-crm mt-0.5" />
                    <div
                      className="text-sm text-muted-foreground whitespace-pre-line [&_strong]:font-semibold"
                      dangerouslySetInnerHTML={{
                        __html: ((sugerencia?.explicacion || 'Análisis realizado por el equipo médico.') as string).replace(/\n/g, '<br />')
                      }}
                    />
                  </div>
                </div>
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
