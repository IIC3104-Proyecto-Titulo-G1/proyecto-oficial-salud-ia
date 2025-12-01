import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Edit, Mail, Info } from 'lucide-react';
import { getDoctorPrefix, consoleLogDebugger } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  medico_tratante_id: string;
  medico_jefe_id?: string;
  prevision?: string;
  nombre_isapre?: string;
  estado_resolucion_aseguradora?: string;
}
interface Sugerencia {
  id: string;
  sugerencia: 'aceptar' | 'rechazar' | 'incierto';
  confianza: number;
  explicacion: string;
}
interface MedicoInfo {
  nombre: string;
  imagen: string | null;
  genero?: string | null;
}
interface ResolucionInfo {
  comentario_medico: string;
  decision_medico?: 'aplicar_ley' | 'no_aplicar_ley';
  decision_final?: 'aceptado' | 'rechazado';
  comentario_final?: string;
}
interface MedicoJefeInfo {
  nombre: string;
  imagen: string | null;
  genero?: string | null;
}
export default function VerCaso() {
  const {
    id
  } = useParams();
  const {
    user,
    userRole
  } = useAuth();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [caso, setCaso] = useState<Caso | null>(null);
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null);
  const [medicoInfo, setMedicoInfo] = useState<MedicoInfo | null>(null);
  const [medicoJefeInfo, setMedicoJefeInfo] = useState<MedicoJefeInfo | null>(null);
  const [resolucionInfo, setResolucionInfo] = useState<ResolucionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [showReopenCase, setShowReopenCase] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [justificacion, setJustificacion] = useState('');
  const [processingDecision, setProcessingDecision] = useState(false);
  const [showExplicacionModal, setShowExplicacionModal] = useState(false);
  const [explicacionDecision, setExplicacionDecision] = useState('');
  const [decisionTemporal, setDecisionTemporal] = useState<'aplicar' | 'rechazar' | null>(null);
  const [editData, setEditData] = useState({
    nombre_paciente: '',
    edad_paciente: '',
    sexo_paciente: '',
    email_paciente: '',
    diagnostico_principal: '',
    sintomas: '',
    historia_clinica: '',
    presion_arterial: '',
    frecuencia_cardiaca: '',
    temperatura: '',
    saturacion_oxigeno: '',
    frecuencia_respiratoria: ''
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [showUpdatedNotice, setShowUpdatedNotice] = useState(false);

  // Estados para guardar datos originales en casos cerrados
  const [originalCasoData, setOriginalCasoData] = useState<Caso | null>(null);
  const [originalSugerenciaData, setOriginalSugerenciaData] = useState<Sugerencia | null>(null);
  const [isCancelingEdit, setIsCancelingEdit] = useState(false);
  useEffect(() => {
    loadCaso();
  }, [id]);
  const resetEditData = (casoData: Caso, options?: {
    resetNotice?: boolean;
  }) => {
    setEditData({
      nombre_paciente: casoData.nombre_paciente || '',
      edad_paciente: casoData.edad_paciente?.toString() || '',
      sexo_paciente: casoData.sexo_paciente || '',
      email_paciente: casoData.email_paciente || '',
      diagnostico_principal: casoData.diagnostico_principal || '',
      sintomas: casoData.sintomas || '',
      historia_clinica: casoData.historia_clinica || '',
      presion_arterial: casoData.presion_arterial || '',
      frecuencia_cardiaca: casoData.frecuencia_cardiaca?.toString() || '',
      temperatura: casoData.temperatura?.toString() || '',
      saturacion_oxigeno: casoData.saturacion_oxigeno?.toString() || '',
      frecuencia_respiratoria: casoData.frecuencia_respiratoria?.toString() || ''
    });
    setEditErrors({});
    if (options?.resetNotice !== false) {
      setShowUpdatedNotice(false);
    }
  };
  const loadCaso = async () => {
    if (!id) return;
    setLoading(true);
    const {
      data: casoData,
      error: casoError
    } = await supabase.from('casos').select('*, estado_resolucion_aseguradora, prevision').eq('id', id).single();
    if (casoError) {
      toast({
        title: 'Error al cargar caso',
        description: casoError.message,
        variant: 'destructive'
      });
      navigate('/dashboard');
      return;
    }
    const {
      data: sugerenciaData
    } = await supabase.from('sugerencia_ia').select('*').eq('caso_id', id).order('fecha_procesamiento', {
      ascending: false
    }).limit(1).maybeSingle();

    // Si el caso está derivado, cargar info del médico que lo derivó y la resolución
    if (casoData?.estado === 'derivado') {
      const {
        data: medicoData
      } = await supabase.from('user_roles').select('nombre, imagen, genero').eq('user_id', casoData.medico_tratante_id).single();
      const {
        data: resolucionData
      } = await supabase.from('resolucion_caso').select('comentario_medico').eq('caso_id', id).single();
      setMedicoInfo(medicoData);
      setResolucionInfo(resolucionData);
    }

    // Si el caso fue cerrado, cargar la resolución
    if (casoData?.estado === 'aceptado' || casoData?.estado === 'rechazado') {
      const {
        data: resolucionData
      } = await supabase.from('resolucion_caso').select('comentario_medico, decision_final, comentario_final').eq('caso_id', id).maybeSingle();
      setResolucionInfo(resolucionData);

      // Cargar info del médico tratante que cerró el caso (siempre)
      const {
        data: medicoTratanteData,
        error: medicoTratanteError
      } = await supabase.from('user_roles').select('nombre, imagen, genero').eq('user_id', casoData.medico_tratante_id).maybeSingle();
      if (medicoTratanteError) {
        consoleLogDebugger('Error al cargar médico tratante:', medicoTratanteError);
      }
      setMedicoInfo(medicoTratanteData);

      // Si fue derivado, también cargar info del médico jefe
      if (casoData?.medico_jefe_id) {
        const {
          data: medicoJefeData,
          error: medicoJefeError
        } = await supabase.from('user_roles').select('nombre, imagen, genero').eq('user_id', casoData.medico_jefe_id).maybeSingle();
        if (medicoJefeError) {
          consoleLogDebugger('Error al cargar médico jefe:', medicoJefeError);
        }
        setMedicoJefeInfo(medicoJefeData);

        // Fallback para médicos tratantes: obtener nombre desde notificación del caso resuelto
        if (!medicoJefeData && userRole === 'medico') {
          const {
            data: notif
          } = await supabase.from('notificaciones').select('mensaje').eq('usuario_id', user?.id).eq('caso_id', id).eq('tipo', 'caso_resuelto').order('fecha_creacion', {
            ascending: false
          }).limit(1).maybeSingle();
          const nombre = notif?.mensaje?.match(/(?:Dr\.|Dra\.|Dr\(a\)\.)\s+(.+?)\s+ha\s/i)?.[1] || null;
          if (nombre) {
            setMedicoJefeInfo({
              nombre,
              imagen: null
            });
          }
        }
      }
    }
    consoleLogDebugger('Caso cargado en VerCaso:', {
      id: casoData?.id,
      estado: casoData?.estado,
      estado_resolucion_aseguradora: (casoData as any)?.estado_resolucion_aseguradora,
      prevision: (casoData as any)?.prevision,
      tieneSugerencia: !!sugerenciaData,
      userRole: userRole,
      debeMostrarBotones: !!sugerenciaData && userRole !== 'admin' && (casoData as any)?.estado_resolucion_aseguradora === 'pendiente_envio'
    });
    setCaso(casoData);
    setSugerencia(sugerenciaData);

    // Si el caso está cerrado y no tenemos datos originales guardados, guardarlos
    if ((casoData?.estado === 'aceptado' || casoData?.estado === 'rechazado') && !originalCasoData) {
      setOriginalCasoData(casoData);
      setOriginalSugerenciaData(sugerenciaData);
    }
    setLoading(false);
  };
  useEffect(() => {
    if (caso) {
      resetEditData(caso);
    }
  }, [caso]);
  const validateEditData = () => {
    const errors: Record<string, string> = {};
    const nombre = editData.nombre_paciente.trim();
    if (!nombre) {
      errors.nombre_paciente = 'El nombre es obligatorio.';
    } else if (nombre.length < 3) {
      errors.nombre_paciente = 'El nombre debe tener al menos 3 caracteres.';
    }
    const edad = Number(editData.edad_paciente);
    if (!Number.isInteger(edad) || edad <= 0 || edad > 120) {
      errors.edad_paciente = 'Ingresa una edad válida entre 1 y 120 años.';
    }
    if (!editData.sexo_paciente) {
      errors.sexo_paciente = 'Selecciona el sexo del paciente.';
    }
    const email = editData.email_paciente.trim();
    // Si se ingresa un email, debe ser válido, pero el campo es opcional
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.email_paciente = 'Ingresa un correo electrónico válido.';
      }
    }
    const diagnostico = editData.diagnostico_principal.trim();
    if (!diagnostico) {
      errors.diagnostico_principal = 'El diagnóstico principal es obligatorio.';
    }
    const presion = editData.presion_arterial.trim();
    if (presion) {
      const match = presion.match(/^(\d{2,3})\/(\d{2,3})$/);
      if (!match) {
        errors.presion_arterial = 'Usa el formato sistólica/diastólica (ej. 120/80).';
      } else {
        const sistolica = Number(match[1]);
        const diastolica = Number(match[2]);
        if (sistolica < 70 || sistolica > 250 || diastolica < 40 || diastolica > 150 || diastolica >= sistolica) {
          errors.presion_arterial = 'Verifica que los valores estén en un rango clínico válido.';
        }
      }
    }
    const frecuenciaCardiaca = editData.frecuencia_cardiaca.trim();
    if (frecuenciaCardiaca) {
      const valor = Number(frecuenciaCardiaca);
      if (!Number.isInteger(valor) || valor < 30 || valor > 220) {
        errors.frecuencia_cardiaca = 'Ingresa pulsaciones entre 30 y 220 lpm.';
      }
    }
    const temperatura = editData.temperatura.trim();
    if (temperatura) {
      const valor = Number(temperatura);
      if (Number.isNaN(valor) || valor < 30 || valor > 45) {
        errors.temperatura = 'Ingresa una temperatura entre 30 y 45 °C.';
      }
    }
    const saturacion = editData.saturacion_oxigeno.trim();
    if (saturacion) {
      const valor = Number(saturacion);
      if (!Number.isInteger(valor) || valor < 70 || valor > 100) {
        errors.saturacion_oxigeno = 'Ingresa un porcentaje entre 70% y 100%.';
      }
    }
    const frecuenciaRespiratoria = editData.frecuencia_respiratoria.trim();
    if (frecuenciaRespiratoria) {
      const valor = Number(frecuenciaRespiratoria);
      if (!Number.isInteger(valor) || valor < 8 || valor > 40) {
        errors.frecuencia_respiratoria = 'Ingresa respiraciones entre 8 y 40 rpm.';
      }
    }
    return errors;
  };
  const handleEditChange = (field: keyof typeof editData, value: string) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
    setEditErrors(prev => ({
      ...prev,
      [field]: ''
    }));
  };
  const handleConfirmEditWithWarning = () => {
    setShowEditWarning(false);
    navigate(`/caso/${id}/editar`);
  };
  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!caso) return;
    const validationErrors = validateEditData();
    if (Object.keys(validationErrors).length > 0) {
      setEditErrors(validationErrors);
      toast({
        title: 'Revisa los datos ingresados',
        description: 'Corrige los campos marcados para continuar.',
        variant: 'destructive'
      });
      return;
    }
    setEditSaving(true);
    try {
      const nombreValue = editData.nombre_paciente.trim();
      const edadValue = Number(editData.edad_paciente);
      const sexoValue = editData.sexo_paciente;
      const emailValue = editData.email_paciente.trim();
      const diagnosticoValue = editData.diagnostico_principal.trim();
      const sintomasValue = editData.sintomas.trim();
      const historiaValue = editData.historia_clinica.trim();
      const presionValue = editData.presion_arterial.trim();
      const frecuenciaCardiacaValue = editData.frecuencia_cardiaca.trim();
      const temperaturaValue = editData.temperatura.trim();
      const saturacionValue = editData.saturacion_oxigeno.trim();
      const frecuenciaRespiratoriaValue = editData.frecuencia_respiratoria.trim();
      const {
        data: updatedCaso,
        error: updateError
      } = await supabase.from('casos').update({
        nombre_paciente: nombreValue,
        edad_paciente: edadValue,
        sexo_paciente: sexoValue,
        email_paciente: emailValue || null,
        diagnostico_principal: diagnosticoValue,
        sintomas: sintomasValue || null,
        historia_clinica: historiaValue || null,
        presion_arterial: presionValue || null,
        frecuencia_cardiaca: frecuenciaCardiacaValue ? Number(frecuenciaCardiacaValue) : null,
        temperatura: temperaturaValue ? Number(temperaturaValue) : null,
        saturacion_oxigeno: saturacionValue ? Number(saturacionValue) : null,
        frecuencia_respiratoria: frecuenciaRespiratoriaValue ? Number(frecuenciaRespiratoriaValue) : null
      }).eq('id', caso.id).select().single();
      if (updateError) throw updateError;

      // Eliminar la sugerencia anterior
      const {
        error: deleteError
      } = await supabase.from('sugerencia_ia').delete().eq('caso_id', caso.id);
      if (deleteError) {
        consoleLogDebugger('Error al eliminar sugerencia anterior:', deleteError);
      }

      // Generar nueva sugerencia IA
      const sugerenciaRandom = Math.random() > 0.5 ? 'aceptar' : 'rechazar';
      const confianzaRandom = Math.floor(Math.random() * 30) + 70;
      const {
        data: nuevaSugerencia,
        error: iaError
      } = await supabase.from('sugerencia_ia').insert([{
        caso_id: caso.id,
        sugerencia: sugerenciaRandom,
        confianza: confianzaRandom,
        explicacion: `Basado en el análisis actualizado de los datos clínicos, se sugiere ${sugerenciaRandom === 'aceptar' ? 'aplicar' : 'no aplicar'} la Ley de Urgencia. Criterios evaluados: estado hemodinámico, signos vitales y diagnóstico principal.`
      }]).select().single();
      if (iaError) throw iaError;

      // Actualizar estado con nueva sugerencia
      setCaso(updatedCaso as Caso);
      setSugerencia(nuevaSugerencia as Sugerencia);
      setShowEditModal(false);
      resetEditData(updatedCaso as Caso, {
        resetNotice: false
      });
      setShowUpdatedNotice(true);
      toast({
        title: 'Caso actualizado',
        description: 'Se ha generado una nueva sugerencia de IA con los datos actualizados.'
      });
    } catch (error: any) {
      toast({
        title: 'Error al actualizar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setEditSaving(false);
    }
  };

  // Handler para aplicar la ley (resultado final: ley aplicada)
  const handleAplicarLey = () => {
    // Si es médico jefe en caso derivado o editado, pedir explicación primero
    if (userRole === 'medico_jefe' && (caso?.estado === 'derivado' || caso?.estado === 'aceptado' || caso?.estado === 'rechazado')) {
      setDecisionTemporal('aplicar');
      setShowExplicacionModal(true);
      return;
    }

    // Si es médico jefe en pendiente_envio y decide en contra de la IA, pedir comentario opcional
    if (userRole === 'medico_jefe' && (caso as any)?.estado_resolucion_aseguradora === 'pendiente_envio' && sugerencia?.sugerencia === 'rechazar') {
      setDecisionTemporal('aplicar');
      setShowExplicacionModal(true);
      return;
    }

    // Flujo normal para médicos o casos pendientes
    if (sugerencia?.sugerencia === 'aceptar') {
      navigate(`/caso/${id}/comunicacion?accion=aceptar&decision=aplicar`);
    } else {
      if (userRole === 'medico_jefe') {
        navigate(`/caso/${id}/comunicacion?accion=rechazar&decision=aplicar`);
      } else {
        setShowRejectModal(true);
      }
    }
  };

  // Handler para NO aplicar la ley (resultado final: ley no aplicada)
  const handleNoAplicarLey = () => {
    // Si es médico jefe en caso derivado o editado, pedir explicación primero
    if (userRole === 'medico_jefe' && (caso?.estado === 'derivado' || caso?.estado === 'aceptado' || caso?.estado === 'rechazado')) {
      setDecisionTemporal('rechazar');
      setShowExplicacionModal(true);
      return;
    }

    // Si es médico jefe en pendiente_envio y decide en contra de la IA, pedir comentario opcional
    if (userRole === 'medico_jefe' && (caso as any)?.estado_resolucion_aseguradora === 'pendiente_envio' && sugerencia?.sugerencia === 'aceptar') {
      setDecisionTemporal('rechazar');
      setShowExplicacionModal(true);
      return;
    }

    // Flujo normal para médicos o casos pendientes
    if (sugerencia?.sugerencia === 'rechazar') {
      navigate(`/caso/${id}/comunicacion?accion=aceptar&decision=rechazar`);
    } else {
      if (userRole === 'medico_jefe') {
        navigate(`/caso/${id}/comunicacion?accion=rechazar&decision=rechazar`);
      } else {
        setShowRejectModal(true);
      }
    }
  };

  // Handler para confirmar explicación y continuar al email
  const handleConfirmExplicacion = async () => {
    if (!decisionTemporal) return;
    setProcessingDecision(true);
    try {
      // Guardar la explicación en resolucion_caso
      const {
        data: resolucionExistente
      } = await supabase.from('resolucion_caso').select('*').eq('caso_id', id).maybeSingle();
      const resultadoFinal = decisionTemporal === 'aplicar' ? 'aceptado' : 'rechazado';
      
      // Si es médico jefe en pendiente_envio y decide en contra de la IA, guardar comentario y resolver directamente (sin derivar)
      const esPendienteEnvio = (caso as any)?.estado_resolucion_aseguradora === 'pendiente_envio';
      const esDecisionContrariaIA = (decisionTemporal === 'aplicar' && sugerencia?.sugerencia === 'rechazar') || 
                                     (decisionTemporal === 'rechazar' && sugerencia?.sugerencia === 'aceptar');
      
      if (userRole === 'medico_jefe' && esPendienteEnvio && esDecisionContrariaIA) {
        // Guardar comentario opcional como razón de la decisión
        if (resolucionExistente) {
          await supabase.from('resolucion_caso').update({
            decision_final: resultadoFinal,
            comentario_medico: explicacionDecision.trim() || null,
            fecha_decision_medico_jefe: new Date().toISOString()
          }).eq('caso_id', id);
        } else {
          await supabase.from('resolucion_caso').insert([{
            caso_id: id,
            decision_final: resultadoFinal,
            comentario_medico: explicacionDecision.trim() || null,
            fecha_decision_medico_jefe: new Date().toISOString()
          }]);
        }

        // Asignar médico jefe si no está asignado
        if (!caso?.medico_jefe_id) {
          await supabase.from('casos').update({
            medico_jefe_id: user?.id
          }).eq('id', id);
        }

        // Actualizar estado del caso directamente (no se deriva porque el médico jefe lo resuelve)
        await supabase.from('casos').update({
          estado: resultadoFinal
        }).eq('id', id);

        // Navegar a comunicación
        const accion = sugerencia?.sugerencia === (decisionTemporal === 'aplicar' ? 'aceptar' : 'rechazar') ? 'aceptar' : 'rechazar';
        navigate(`/caso/${id}/comunicacion?accion=${accion}&decision=${decisionTemporal}`);
        return;
      }

      // Flujo normal para casos derivados o editados
      if (resolucionExistente) {
        await supabase.from('resolucion_caso').update({
          decision_final: resultadoFinal,
          comentario_final: explicacionDecision.trim() || null,
          fecha_decision_medico_jefe: new Date().toISOString()
        }).eq('caso_id', id);
      } else {
        await supabase.from('resolucion_caso').insert([{
          caso_id: id,
          decision_final: resultadoFinal,
          comentario_final: explicacionDecision.trim() || null,
          fecha_decision_medico_jefe: new Date().toISOString()
        }]);
      }

      // Asignar médico jefe si no está asignado
      if (!caso?.medico_jefe_id) {
        await supabase.from('casos').update({
          medico_jefe_id: user?.id
        }).eq('id', id);
      }

      // Navegar a comunicación
      const accion = sugerencia?.sugerencia === (decisionTemporal === 'aplicar' ? 'aceptar' : 'rechazar') ? 'aceptar' : 'rechazar';
      navigate(`/caso/${id}/comunicacion?accion=${accion}&decision=${decisionTemporal}`);
    } catch (error: any) {
      toast({
        title: 'Error al guardar explicación',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setProcessingDecision(false);
    }
  };
  const handleConfirmReject = async () => {
    if (!justificacion.trim()) {
      toast({
        title: 'Justificación requerida',
        description: 'Debe ingresar una justificación para rechazar la sugerencia',
        variant: 'destructive'
      });
      return;
    }
    setProcessingDecision(true);
    try {
      // Verificar si ya existe una resolución
      const {
        data: resolucionExistente
      } = await supabase.from('resolucion_caso').select('*').eq('caso_id', id).maybeSingle();

      // Si es médico jefe, rechazar definitivamente
      if (userRole === 'medico_jefe') {
        // Primero asignar el médico jefe al caso si está derivado
        if (caso?.estado === 'derivado') {
          const {
            error: assignError
          } = await supabase.from('casos').update({
            medico_jefe_id: user?.id
          }).eq('id', id);
          if (assignError) throw assignError;
        }
        if (resolucionExistente) {
          // Actualizar resolución existente
          const {
            error: resolucionError
          } = await supabase.from('resolucion_caso').update({
            decision_final: 'rechazado',
            comentario_final: justificacion,
            fecha_decision_medico_jefe: new Date().toISOString()
          }).eq('caso_id', id);
          if (resolucionError) throw resolucionError;
        } else {
          // Crear nueva resolución
          const {
            error: resolucionError
          } = await supabase.from('resolucion_caso').insert([{
            caso_id: id,
            decision_final: 'rechazado',
            comentario_final: justificacion,
            fecha_decision_medico_jefe: new Date().toISOString()
          }]);
          if (resolucionError) throw resolucionError;
        }
        const {
          error: updateError
        } = await supabase.from('casos').update({
          estado: 'rechazado'
        }).eq('id', id);
        if (updateError) throw updateError;
        toast({
          title: 'Caso rechazado',
          description: 'El caso ha sido rechazado definitivamente'
        });
      } else {
        // Si es médico normal, derivar a médico jefe
        if (resolucionExistente) {
          // Actualizar resolución existente
          const {
            error: resolucionError
          } = await supabase.from('resolucion_caso').update({
            decision_medico: 'rechazado',
            comentario_medico: justificacion,
            decision_final: null,
            comentario_final: null,
            fecha_decision_medico: new Date().toISOString()
          }).eq('caso_id', id);
          if (resolucionError) throw resolucionError;
        } else {
          // Crear nueva resolución
          const {
            error: resolucionError
          } = await supabase.from('resolucion_caso').insert([{
            caso_id: id,
            decision_medico: 'rechazado',
            comentario_medico: justificacion,
            fecha_decision_medico: new Date().toISOString()
          }]);
          if (resolucionError) throw resolucionError;
        }
        const {
          error: updateError
        } = await supabase.from('casos').update({
          estado: 'derivado'
        }).eq('id', id);
        if (updateError) throw updateError;
        toast({
          title: 'Caso derivado',
          description: 'El caso ha sido derivado al pool de médicos jefe'
        });
      }
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Error al procesar decisión',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setProcessingDecision(false);
    }
  };

  // Handler para cancelar la edición y restaurar datos originales
  const handleCancelEdit = async () => {
    if (!originalCasoData || !id) return;
    setIsCancelingEdit(true);
    try {
      // Restaurar los datos del caso a los valores originales
      const {
        data: restoredCaso,
        error: updateError
      } = await supabase.from('casos').update({
        nombre_paciente: originalCasoData.nombre_paciente,
        edad_paciente: originalCasoData.edad_paciente,
        sexo_paciente: originalCasoData.sexo_paciente,
        email_paciente: originalCasoData.email_paciente,
        diagnostico_principal: originalCasoData.diagnostico_principal,
        sintomas: originalCasoData.sintomas,
        historia_clinica: originalCasoData.historia_clinica,
        presion_arterial: originalCasoData.presion_arterial,
        frecuencia_cardiaca: originalCasoData.frecuencia_cardiaca,
        temperatura: originalCasoData.temperatura,
        saturacion_oxigeno: originalCasoData.saturacion_oxigeno,
        frecuencia_respiratoria: originalCasoData.frecuencia_respiratoria
      }).eq('id', id).select().single();
      if (updateError) throw updateError;

      // Restaurar la sugerencia original: eliminar TODAS las sugerencias y crear una nueva con los datos originales
      if (originalSugerenciaData) {
        // Primero, eliminar TODAS las sugerencias del caso
        const {
          error: deleteAllError
        } = await supabase.from('sugerencia_ia').delete().eq('caso_id', id);
        if (deleteAllError) {
          consoleLogDebugger('Error al eliminar todas las sugerencias:', deleteAllError);
        }

        // Luego, crear una nueva sugerencia con los datos originales
        const {
          data: nuevaSugerencia,
          error: insertError
        } = await supabase.from('sugerencia_ia').insert([{
          caso_id: id,
          sugerencia: originalSugerenciaData.sugerencia,
          confianza: originalSugerenciaData.confianza,
          explicacion: originalSugerenciaData.explicacion
        }]).select().single();
        if (insertError) {
          throw new Error('Error al restaurar la sugerencia original: ' + insertError.message);
        }

        // Actualizar el estado con la nueva sugerencia creada
        setSugerencia(nuevaSugerencia);
      }

      // Actualizar estados con datos restaurados
      setCaso(restoredCaso as Caso);
      setShowReopenCase(false);
      setShowUpdatedNotice(false);
      toast({
        title: 'Edición cancelada',
        description: 'Se han restaurado los datos originales del caso.'
      });
    } catch (error: any) {
      toast({
        title: 'Error al cancelar edición',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsCancelingEdit(false);
    }
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando caso...</p>
      </div>;
  }
  if (!caso) {
    return <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Caso no encontrado</p>
      </div>;
  }

  // Permitir vista incluso sin sugerencia (casos muy antiguos o con errores)
  if (!sugerencia) {
    consoleLogDebugger('Caso sin sugerencia de IA:', id);
  }
  return <div className="min-h-screen bg-muted/30">
      <header className="bg-gradient-to-r from-primary to-secondary text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                if (userRole === 'admin') {
                  navigate('/admin?tab=casos');
                } else {
                  navigate('/dashboard');
                }
              }} 
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
        {/* Caso cerrado sin derivar - Para médicos normales */}
        {(caso.estado === 'rechazado' || caso.estado === 'aceptado') && userRole === 'medico' && !caso.medico_jefe_id && caso.medico_tratante_id === user?.id && <Card className={caso.estado === 'aceptado' ? 'border-crm/30 bg-crm/5' : 'border-destructive/30 bg-destructive/5'}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className={caso.estado === 'aceptado' ? 'text-crm' : 'text-destructive'}>
                    {caso.estado === 'aceptado' ? 'Ley Aplicada' : 'Ley No Aplicada'}
                  </CardTitle>
                  <CardDescription>
                    {medicoInfo?.nombre ? `${getDoctorPrefix(medicoInfo.genero)} ${medicoInfo.nombre} ha determinado que este caso ${caso.estado === 'aceptado' ? 'aplica' : 'no aplica'} para la ley de urgencia.` : `Se ${caso.estado === 'aceptado' ? 'aplicó' : 'no aplicó'} la ley de urgencia a este caso.`}
                  </CardDescription>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors cursor-help">
                        <Info className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>El caso se encuentra cerrado. La edición de los casos cerrados solo está permitida para médicos jefe.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {resolucionInfo?.comentario_final && <div className="bg-white rounded-lg p-4 border border-muted">
                  <p className="text-sm font-medium mb-2">Resolución Final:</p>
                  <p className="text-sm text-muted-foreground">{resolucionInfo.comentario_final}</p>
                </div>}
              <Button size="lg" onClick={() => navigate(`/caso/${id}/comunicacion`)} className="w-full">
                <Mail className="w-5 h-5 mr-2" />
                Enviar Correo a Paciente
              </Button>
            </CardContent>
          </Card>}

        {/* Caso cerrado derivado - Para médicos normales */}
        {(caso.estado === 'rechazado' || caso.estado === 'aceptado') && userRole === 'medico' && caso.medico_jefe_id && caso.medico_tratante_id === user?.id && <Card className={caso.estado === 'aceptado' ? 'border-crm/30 bg-crm/5' : 'border-destructive/30 bg-destructive/5'}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className={caso.estado === 'aceptado' ? 'text-crm' : 'text-destructive'}>
                    {caso.estado === 'aceptado' ? 'Ley Aplicada por Médico Jefe' : 'Ley No Aplicada por Médico Jefe'}
                  </CardTitle>
                  <CardDescription>
                    {medicoJefeInfo?.nombre ? `${getDoctorPrefix(medicoJefeInfo.genero)} ${medicoJefeInfo.nombre} decidió que ${caso.estado === 'aceptado' ? 'aplica' : 'no aplica'} la ley de urgencia para este caso.` : `Se ${caso.estado === 'aceptado' ? 'aplicó' : 'no aplicó'} la ley de urgencia a este caso.`}
                  </CardDescription>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors cursor-help">
                        <Info className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>El caso se encuentra cerrado. La edición de los casos cerrados solo está permitida para médicos jefe.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {resolucionInfo?.comentario_medico && <div className="bg-white rounded-lg p-4 border border-muted">
                  <p className="text-sm font-medium mb-2">Razón de Derivación (su comentario):</p>
                  <p className="text-sm text-muted-foreground">{resolucionInfo.comentario_medico}</p>
                </div>}
              {resolucionInfo?.comentario_final && medicoJefeInfo && <div className="bg-white rounded-lg p-4 border border-muted">
                  <p className="text-sm font-medium mb-2">Resolución Final de {medicoJefeInfo.nombre}:</p>
                  <p className="text-sm text-muted-foreground">{resolucionInfo.comentario_final}</p>
                </div>}
              <Button size="lg" onClick={() => navigate(`/caso/${id}/comunicacion`)} className="w-full">
                <Mail className="w-5 h-5 mr-2" />
                Enviar Correo a Paciente
              </Button>
            </CardContent>
          </Card>}

        {/* Casos cerrados - Médico jefe y admin pueden ver */}
        {(caso.estado === 'rechazado' || caso.estado === 'aceptado') && (userRole === 'medico_jefe' || userRole === 'admin') && !showReopenCase && <Card className={caso.estado === 'aceptado' ? 'border-crm/30 bg-crm/5' : 'border-destructive/30 bg-destructive/5'}>
            <CardHeader>
              <CardTitle className={caso.estado === 'aceptado' ? 'text-crm' : 'text-destructive'}>
                {caso.estado === 'aceptado' ? 'Ley Aplicada' : 'Ley No Aplicada'}
              </CardTitle>
              <CardDescription>
                {caso.medico_jefe_id && medicoJefeInfo ? `${getDoctorPrefix(medicoJefeInfo.genero)} ${medicoJefeInfo.nombre} ha determinado que este caso ${caso.estado === 'aceptado' ? 'aplica' : 'no aplica'} para la ley de urgencia.` : medicoInfo ? `${getDoctorPrefix(medicoInfo.genero)} ${medicoInfo.nombre} ha determinado que este caso ${caso.estado === 'aceptado' ? 'aplica' : 'no aplica'} para la ley de urgencia.` : `Se ${caso.estado === 'aceptado' ? 'aplicó' : 'no aplicó'} la ley de urgencia a este caso.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {resolucionInfo?.comentario_medico && caso.medico_jefe_id && medicoInfo && <div className="bg-white rounded-lg p-4 border border-muted">
                  <div className="flex items-center gap-3 mb-3">
                    {medicoInfo.imagen ? <img src={medicoInfo.imagen} alt={medicoInfo.nombre} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-semibold text-primary">
                          {medicoInfo.nombre.charAt(0)}
                        </span>
                      </div>}
                    <div>
                    <p className="font-medium">{medicoInfo.nombre}</p>
                      <p className="text-sm text-muted-foreground">Médico Tratante</p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="text-sm font-medium mb-2">Opinión médico tratante:</p>
                    <Badge variant={resolucionInfo.decision_medico === 'aplicar_ley' ? 'default' : 'destructive'} className="text-xs">
                      {resolucionInfo.decision_medico === 'aplicar_ley' ? 'Aplicar ley' : 'No aplicar ley'}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium mb-2">Explicación:</p>
                  <p className="text-sm text-muted-foreground">{resolucionInfo.comentario_medico}</p>
                </div>}
              {resolucionInfo?.comentario_final && medicoJefeInfo && <div className="bg-white rounded-lg p-4 border border-muted">
                  <div className="flex items-center gap-3 mb-3">
                    {medicoJefeInfo.imagen ? <img src={medicoJefeInfo.imagen} alt={medicoJefeInfo.nombre} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-semibold text-primary">
                          {medicoJefeInfo.nombre.charAt(0)}
                        </span>
                      </div>}
                    <div>
                    <p className="font-medium">{medicoJefeInfo.nombre}</p>
                      <p className="text-sm text-muted-foreground">Médico Jefe</p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="text-sm font-medium mb-2">Resolución Final:</p>
                    <Badge variant={caso.estado === 'aceptado' ? 'default' : 'destructive'} className="text-xs">
                      {caso.estado === 'aceptado' ? 'Aplicar ley' : 'No aplicar ley'}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium mb-2">Explicación:</p>
                  <p className="text-sm text-muted-foreground">{resolucionInfo.comentario_final}</p>
                </div>}
              <div className={`grid gap-4 ${
                userRole === 'admin' 
                  ? 'grid-cols-1' 
                  : (caso as any).estado_resolucion_aseguradora === 'pendiente_envio'
                    ? 'grid-cols-1 md:grid-cols-2' 
                    : 'grid-cols-1'
              }`}>
                <Button size="lg" onClick={() => navigate(`/caso/${id}/comunicacion`)} className="w-full">
                  <Mail className="w-5 h-5 mr-2" />
                  Enviar Correo a Paciente
                </Button>
                {/* Solo mostrar botón de editar si está en pendiente_envio y NO es admin */}
                {userRole !== 'admin' && (caso as any).estado_resolucion_aseguradora === 'pendiente_envio' && (
                  <Button size="lg" variant="outline" onClick={() => setShowEditWarning(true)} className="w-full border-amber-500 text-amber-700 hover:bg-amber-50 hover:text-amber-700 [&_svg]:text-amber-700 hover:[&_svg]:text-amber-700">
                  <Edit className="w-5 h-5 mr-2" />
                  Editar Caso
                </Button>
                )}
              </div>
            </CardContent>
          </Card>}

        {/* Mensaje de Caso Derivado para médicos normales */}
        {caso.estado === 'derivado' && userRole !== 'medico_jefe' && userRole !== 'admin' && <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-800">Caso Derivado</CardTitle>
              <CardDescription className="text-amber-700">
                Este caso ha sido derivado al pool de médicos jefe y ya no puede ser modificado por el médico tratante.
              </CardDescription>
            </CardHeader>
            {resolucionInfo && <CardContent>
                <div className="bg-white rounded-lg p-4 border border-amber-200">
                  <p className="text-sm font-medium text-amber-900 mb-2">Razón de Derivación:</p>
                  <p className="text-sm text-amber-800">{resolucionInfo.comentario_medico}</p>
                </div>
              </CardContent>}
          </Card>}

        {/* Información del médico que derivó - Para médicos jefe y admin */}
        {caso.estado === 'derivado' && (userRole === 'medico_jefe' || userRole === 'admin') && medicoInfo && resolucionInfo && <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-800">Caso Derivado</CardTitle>
              <CardDescription className="text-amber-700">
                Este caso fue derivado por un médico tratante que rechazó la sugerencia de IA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {medicoInfo.imagen ? <img src={medicoInfo.imagen} alt={medicoInfo.nombre} className="w-16 h-16 rounded-full object-cover border-2 border-amber-300" /> : <div className="w-16 h-16 rounded-full bg-amber-200 flex items-center justify-center border-2 border-amber-300">
                    <span className="text-2xl font-bold text-amber-700">
                      {medicoInfo.nombre.charAt(0)}
                    </span>
                  </div>}
                <div>
                  <p className="font-medium text-amber-900">{medicoInfo.nombre}</p>
                  <p className="text-sm text-amber-700">Médico Tratante</p>
                </div>
              </div>
              <div className="mb-3">
                <p className="text-sm font-medium text-amber-900 mb-2">Opinión médico tratante:</p>
                <Badge variant={resolucionInfo.decision_medico === 'aplicar_ley' ? 'default' : 'destructive'} className="text-xs">
                  {resolucionInfo.decision_medico === 'aplicar_ley' ? 'Aplicar ley' : 'No aplicar ley'}
                </Badge>
              </div>
              <div className="bg-white rounded-lg p-4 border border-amber-200">
                <p className="text-sm font-medium text-amber-900 mb-2">Explicación:</p>
                <p className="text-sm text-amber-800">{resolucionInfo.comentario_medico}</p>
              </div>
            </CardContent>
          </Card>}

        {/* Datos del Paciente */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Datos del paciente</h2>
                <CardTitle>{caso.nombre_paciente}</CardTitle>
                <CardDescription>
                  {caso.edad_paciente} años • {caso.sexo_paciente === 'M' ? 'Masculino' : caso.sexo_paciente === 'F' ? 'Femenino' : 'Otro'}
                </CardDescription>
                {/* Tags de Previsión y Resolución Aseguradora */}
                {((caso as any).prevision || (caso as any).estado_resolucion_aseguradora) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(caso as any).prevision && (
                      <Badge variant="outline" className="text-xs">
                        {(caso as any).prevision === 'Isapre' && (caso as any).nombre_isapre 
                          ? `Isapre: ${(caso as any).nombre_isapre}` 
                          : (caso as any).prevision}
                      </Badge>
                    )}
                    {(caso as any).prevision && (caso as any).estado_resolucion_aseguradora && (
                      <Badge 
                        variant={
                          (caso as any).estado_resolucion_aseguradora === 'aceptada' 
                            ? 'default' 
                            : (caso as any).estado_resolucion_aseguradora === 'rechazada' 
                            ? 'destructive' 
                            : 'secondary'
                        }
                        className="text-xs font-medium"
                      >
                        {(caso as any).estado_resolucion_aseguradora === 'aceptada' 
                          ? `Aceptado por ${(caso as any).prevision}` 
                          : (caso as any).estado_resolucion_aseguradora === 'rechazada' 
                          ? `Rechazado por ${(caso as any).prevision}`
                          : (caso as any).estado_resolucion_aseguradora === 'pendiente_envio'
                          ? `Pendiente envío a ${(caso as any).prevision}`
                          : `Pendiente resolución ${(caso as any).prevision}`}
                      </Badge>
                    )}
              </div>
                )}
              </div>
              {/* Botón de editar datos: solo cuando está en estado derivado o pendiente (caso sin dictaminar) */}
              {(caso.estado === 'derivado' || caso.estado === 'pendiente') && (caso as any).estado_resolucion_aseguradora === 'pendiente_envio' && <Button variant="outline" size="sm" onClick={() => setShowEditWarning(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Editar datos
                </Button>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showUpdatedNotice && <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle>Datos actualizados después de la evaluación</AlertTitle>
                <AlertDescription>
                  La evaluación de IA se generó con los valores anteriores. Considera volver a evaluar el caso si los cambios afectan la decisión.
                </AlertDescription>
              </Alert>}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Diagnóstico Principal</p>
              <p className="text-base">{caso.diagnostico_principal}</p>
            </div>
            {caso.sintomas && <div>
                <p className="text-sm font-medium text-muted-foreground">Síntomas</p>
                <p className="text-base">{caso.sintomas}</p>
              </div>}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t">
              {caso.presion_arterial && <div>
                  <p className="text-sm font-medium text-muted-foreground">PA</p>
                  <p className="text-base">{caso.presion_arterial}</p>
                </div>}
              {caso.frecuencia_cardiaca && <div>
                  <p className="text-sm font-medium text-muted-foreground">FC</p>
                  <p className="text-base">{caso.frecuencia_cardiaca} lpm</p>
                </div>}
              {caso.temperatura && <div>
                  <p className="text-sm font-medium text-muted-foreground">Temp</p>
                  <p className="text-base">{caso.temperatura}°C</p>
                </div>}
              {caso.saturacion_oxigeno && <div>
                  <p className="text-sm font-medium text-muted-foreground">SpO₂</p>
                  <p className="text-base">{caso.saturacion_oxigeno}%</p>
                </div>}
              {caso.frecuencia_respiratoria && <div>
                  <p className="text-sm font-medium text-muted-foreground">FR</p>
                  <p className="text-base">{caso.frecuencia_respiratoria} rpm</p>
                </div>}
            </div>
          </CardContent>
        </Card>

        {/* Resultado IA */}
        {sugerencia && <Card className="border-2 border-crm/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Sugerencia de IA</CardTitle>
                <Badge variant={sugerencia.sugerencia === 'aceptar' ? 'default' : 'destructive'} className="text-base px-4 py-1">
                  {sugerencia.sugerencia === 'aceptar' ? <CheckCircle className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                  {sugerencia.sugerencia === 'aceptar' ? 'Aplica Ley de Urgencia' : 'No Aplica Ley de Urgencia'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Nivel de Confianza</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                    <div className="bg-crm h-full transition-all" style={{
                  width: `${sugerencia.confianza}%`
                }} />
                  </div>
                  <span className="text-xl font-bold text-crm">{sugerencia.confianza}%</span>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-crm mt-0.5" />
                  <div>
                    <p className="font-medium mb-2">Explicación del Análisis</p>
                    <div
                      className="text-sm text-muted-foreground whitespace-pre-line [&_strong]:font-semibold"
                      dangerouslySetInnerHTML={{
                        __html: (sugerencia.explicacion || '').replace(/\n/g, '<br />')
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>}

        {/* Acciones para casos - Solo si está en pendiente_envio */}
        {sugerencia && userRole !== 'admin' && (caso as any).estado_resolucion_aseguradora === 'pendiente_envio' && <Card>
            <CardHeader>
              <CardTitle>Decisión del Médico</CardTitle>
              <CardDescription>
                {userRole === 'medico_jefe' ? 'Como médico jefe, puede tomar la decisión final sobre este caso.' : 'Revise la sugerencia de IA y tome una decisión sobre el caso'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button size="lg" onClick={handleAplicarLey} className={sugerencia?.sugerencia === 'aceptar' ? "w-full bg-crm hover:bg-crm/90 text-white shadow-md shadow-crm/30" : "w-full bg-crm/10 border-crm text-crm hover:bg-crm/20"}>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Aplicar Ley
                </Button>
                <Button size="lg" onClick={handleNoAplicarLey} className={sugerencia?.sugerencia === 'rechazar' ? "w-full bg-destructive hover:bg-destructive/90 text-white shadow-md shadow-destructive/30" : "w-full bg-destructive/10 border-destructive text-destructive hover:bg-destructive/20"}>
                  <XCircle className="w-5 h-5 mr-2" />
                  No Aplicar Ley
                </Button>
              </div>
              {/* Botón para cancelar edición en casos cerrados que han sido reabiertos */}
              {(caso.estado === 'aceptado' || caso.estado === 'rechazado') && showReopenCase && <Button size="lg" variant="outline" onClick={handleCancelEdit} disabled={isCancelingEdit} className="w-full border-amber-500 text-amber-700 hover:bg-amber-50 hover:text-amber-700 [&_svg]:text-amber-700 hover:[&_svg]:text-amber-700">
                  {isCancelingEdit ? 'Cancelando...' : 'Cancelar Edición'}
                </Button>}
            </CardContent>
          </Card>}

      </main>

      {/* Modal de advertencia antes de editar */}
      <Dialog open={showEditWarning} onOpenChange={setShowEditWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Deseas editar los datos del caso?</DialogTitle>
            <DialogDescription>
              Se generará una nueva sugerencia de la IA, reemplazando la anterior. ¿Deseas continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditWarning(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmEditWithWarning}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de edición */}
      <Dialog open={showEditModal} onOpenChange={open => {
      setShowEditModal(open);
      if (!open && caso) {
        resetEditData(caso);
      }
    }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Editar datos del caso</DialogTitle>
            <DialogDescription>
              Actualiza la información del paciente y sus signos vitales. Se aplican las mismas validaciones que al crear un caso.
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col flex-1 overflow-hidden" onSubmit={handleSaveEdit}>
          <div className="overflow-y-auto flex-1 pr-2 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="edit-nombre">Nombre completo *</Label>
                <Input id="edit-nombre" value={editData.nombre_paciente} onChange={e => handleEditChange('nombre_paciente', e.target.value)} className={editErrors.nombre_paciente ? 'border-destructive focus-visible:ring-destructive' : undefined} />
                {editErrors.nombre_paciente && <p className="text-sm text-destructive">{editErrors.nombre_paciente}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-edad">Edad *</Label>
                <Input id="edit-edad" type="number" value={editData.edad_paciente} onChange={e => handleEditChange('edad_paciente', e.target.value)} className={editErrors.edad_paciente ? 'border-destructive focus-visible:ring-destructive' : undefined} />
                {editErrors.edad_paciente && <p className="text-sm text-destructive">{editErrors.edad_paciente}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-sexo">Sexo *</Label>
                <Select value={editData.sexo_paciente} onValueChange={value => handleEditChange('sexo_paciente', value)}>
                  <SelectTrigger className={editErrors.sexo_paciente ? 'border-destructive focus-visible:ring-destructive' : undefined}>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
                {editErrors.sexo_paciente && <p className="text-sm text-destructive">{editErrors.sexo_paciente}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-email">Correo electrónico</Label>
                <Input id="edit-email" type="email" value={editData.email_paciente} onChange={e => handleEditChange('email_paciente', e.target.value)} className={editErrors.email_paciente ? 'border-destructive focus-visible:ring-destructive' : undefined} />
                {editErrors.email_paciente && <p className="text-sm text-destructive">{editErrors.email_paciente}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-diagnostico">Diagnóstico Principal *</Label>
              <Input id="edit-diagnostico" value={editData.diagnostico_principal} onChange={e => handleEditChange('diagnostico_principal', e.target.value)} className={editErrors.diagnostico_principal ? 'border-destructive focus-visible:ring-destructive' : undefined} />
              {editErrors.diagnostico_principal && <p className="text-sm text-destructive">{editErrors.diagnostico_principal}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-sintomas">Síntomas</Label>
              <Textarea id="edit-sintomas" value={editData.sintomas} onChange={e => handleEditChange('sintomas', e.target.value)} rows={3} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-historia">Historia Clínica</Label>
              <Textarea id="edit-historia" value={editData.historia_clinica} onChange={e => handleEditChange('historia_clinica', e.target.value)} rows={3} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="edit-presion">Presión Arterial</Label>
                <Input id="edit-presion" placeholder="120/80" value={editData.presion_arterial} onChange={e => handleEditChange('presion_arterial', e.target.value)} className={editErrors.presion_arterial ? 'border-destructive focus-visible:ring-destructive' : undefined} />
                {editErrors.presion_arterial && <p className="text-sm text-destructive">{editErrors.presion_arterial}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-fc">Frecuencia Cardíaca (lpm)</Label>
                <Input id="edit-fc" type="number" value={editData.frecuencia_cardiaca} onChange={e => handleEditChange('frecuencia_cardiaca', e.target.value)} className={editErrors.frecuencia_cardiaca ? 'border-destructive focus-visible:ring-destructive' : undefined} />
                {editErrors.frecuencia_cardiaca && <p className="text-sm text-destructive">{editErrors.frecuencia_cardiaca}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-temp">Temperatura (°C)</Label>
                <Input id="edit-temp" type="number" step="0.1" value={editData.temperatura} onChange={e => handleEditChange('temperatura', e.target.value)} className={editErrors.temperatura ? 'border-destructive focus-visible:ring-destructive' : undefined} />
                {editErrors.temperatura && <p className="text-sm text-destructive">{editErrors.temperatura}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-spo2">Saturación de Oxígeno (%)</Label>
                <Input id="edit-spo2" type="number" value={editData.saturacion_oxigeno} onChange={e => handleEditChange('saturacion_oxigeno', e.target.value)} className={editErrors.saturacion_oxigeno ? 'border-destructive focus-visible:ring-destructive' : undefined} />
                {editErrors.saturacion_oxigeno && <p className="text-sm text-destructive">{editErrors.saturacion_oxigeno}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-fr">Frecuencia Respiratoria (rpm)</Label>
                <Input id="edit-fr" type="number" value={editData.frecuencia_respiratoria} onChange={e => handleEditChange('frecuencia_respiratoria', e.target.value)} className={editErrors.frecuencia_respiratoria ? 'border-destructive focus-visible:ring-destructive' : undefined} />
                {editErrors.frecuencia_respiratoria && <p className="text-sm text-destructive">{editErrors.frecuencia_respiratoria}</p>}
              </div>
            </div>
          </div>

            <DialogFooter className="gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} disabled={editSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Rechazo */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Derivar a Médico Jefe</DialogTitle>
            <DialogDescription>
              Como tu decisión es opuesta a la sugerencia de la inteligencia artificial, el caso será derivado a un médico jefe para su verificación. Por favor, ingrese una justificación.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="justificacion">Justificación del Rechazo *</Label>
              <Textarea id="justificacion" value={justificacion} onChange={e => setJustificacion(e.target.value)} rows={4} placeholder="Explique las razones por las cuales rechaza la sugerencia de IA..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmReject} disabled={processingDecision}>
              {processingDecision ? 'Procesando...' : 'Confirmar Rechazo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Explicación de Decisión (Médico Jefe) */}
      <Dialog open={showExplicacionModal} onOpenChange={setShowExplicacionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comentario Opcional</DialogTitle>
            <DialogDescription>
              {userRole === 'medico_jefe' && (caso as any)?.estado_resolucion_aseguradora === 'pendiente_envio' && 
               ((decisionTemporal === 'aplicar' && sugerencia?.sugerencia === 'rechazar') || 
                (decisionTemporal === 'rechazar' && sugerencia?.sugerencia === 'aceptar'))
                ? 'Su decisión es opuesta a la recomendación de la IA. Puede agregar un comentario opcional explicando su decisión. El caso será resuelto directamente sin derivación.'
                : `Por favor, explique brevemente su decisión sobre ${decisionTemporal === 'aplicar' ? 'aplicar' : 'no aplicar'} la ley de urgencia. Esta explicación será visible en la resolución final del caso (opcional).`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="explicacion">Comentario (Opcional)</Label>
              <Textarea id="explicacion" value={explicacionDecision} onChange={e => setExplicacionDecision(e.target.value)} rows={4} placeholder="Explique los motivos de su decisión..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
            setShowExplicacionModal(false);
            setExplicacionDecision('');
            setDecisionTemporal(null);
          }}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmExplicacion} disabled={processingDecision}>
              {processingDecision ? 'Procesando...' : 'Continuar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
}
