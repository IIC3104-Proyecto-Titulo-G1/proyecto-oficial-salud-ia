import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { consoleLogDebugger } from '@/lib/utils';
import { ArrowLeft, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';
import { EVALUATION_CONFIG } from '@/config/evaluation';

// Schema de validación con zod
const formSchema = z.object({
  nombre_paciente: z.string()
    .trim()
    .min(4, 'El nombre debe tener al menos 4 caracteres')
    .max(50, 'El nombre no puede exceder 50 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios'),
  edad: z.number()
    .int('La edad debe ser un número entero')
    .min(0, 'La edad no puede ser negativa')
    .max(120, 'La edad no puede ser mayor a 120 años'),
  sexo: z.string().min(1, 'Selecciona el sexo del paciente'),
  email_paciente: z.string()
    .trim()
    .max(255, 'El correo no puede exceder 255 caracteres')
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Ingresa un correo electrónico válido',
    })
    .optional(),
  diagnostico_principal: z.string()
    .trim()
    .min(10, 'El diagnóstico debe tener al menos 10 caracteres'),
  sintomas: z.string()
    .trim()
    .min(10, 'Los síntomas deben tener al menos 10 caracteres'),
  historia_clinica: z.string()
    .trim()
    .min(5, 'La historia clínica debe tener al menos 5 caracteres'),
  presion_arterial: z.string().optional(),
  frecuencia_cardiaca: z.string().optional(),
  temperatura: z.string().optional(),
  saturacion_oxigeno: z.string().optional(),
  frecuencia_respiratoria: z.string().optional(),
});

// Tipado local extendido hasta regenerar los tipos de Supabase
type CasoRowExpanded = Database['public']['Tables']['casos']['Row'] & Partial<{
  episodio: string;
  centro: string;
  fecha_ingreso: string;
  pa_sistolica: number;
  pa_diastolica: number;
  pa_media: number;
  fc: number;
  fr: number;
  temperatura_c: number;
  sat_o2: number;
  glasgow: number;
  fio2: number;
  fio2_ge_50: boolean;
  vm: boolean;
  antecedentes_cardiacos: boolean;
  antecedentes_diabeticos: boolean;
  antecedentes_hta: boolean;
  hb: number;
  creatinina: number;
  bun: number;
  sodio: number;
  potasio: number;
  troponinas_alteradas: boolean;
  triage: string | number;
  tipo_cama: string;
  ecg_alterado: boolean;
  dreo: boolean;
  dva: boolean;
  compromiso_conciencia: boolean;
  rnm_protocol_stroke: boolean;
  pcr: boolean;
  cirugia: boolean;
  cirugia_same_day: boolean;
  hemodinamia: boolean;
  hemodinamia_same_day: boolean;
  endoscopia: boolean;
  endoscopia_same_day: boolean;
  dialisis: boolean;
  trombolisis: boolean;
  trombolisis_same_day: boolean;
  transfusiones: number;
}>;

export default function NuevoCaso() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { id: editingCaseId } = useParams();
  const isEditing = Boolean(editingCaseId);
  const [loading, setLoading] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const [progress, setProgress] = useState(0);

  const [evaluationMethod, setEvaluationMethod] = useState('rules');
  const testDatasets = {
    critico: {
      // Identificación del episodio
      episodio: 'EP-2024-TEST-001',
      centro: 'Hospital Regional de Santiago',
      fecha_ingreso: new Date().toISOString().slice(0, 16),

      // Datos del paciente
      nombre_paciente: 'Juan Carlos Pérez',
      edad: '65',
      sexo: 'M',
      email_paciente: 'juan.perez@email.com',

      // Previsión
      prevision: 'Fonasa',
      nombre_isapre: '',

      // Diagnóstico
      diagnostico_principal: 'Infarto agudo de miocardio con supradesnivel del segmento ST',
      sintomas: 'Dolor torácico opresivo irradiado a brazo izquierdo, disnea, sudoración profusa',
      historia_clinica: 'Paciente con antecedentes de hipertensión arterial y diabetes mellitus tipo 2',
      descripcion_adicional: 'Paciente refiere dolor de inicio súbito hace 2 horas',

      // Signos vitales
      pa_sistolica: '85',
      pa_diastolica: '55',
      fc: '125',
      fr: '22',
      temperatura_c: '36.8',
      sat_o2: '92',
      glasgow: '14',

      // Soporte respiratorio
      fio2: '40',
      fio2_ge_50: false,
      vm: false,

      // Antecedentes médicos
      antecedentes_cardiacos: false,
      antecedentes_diabeticos: true,
      antecedentes_hta: true,

      // Laboratorio
      hb: '11.5',
      creatinina: '1.2',
      bun: '25',
      sodio: '138',
      potasio: '4.2',
      troponinas_alteradas: true,

      // Evaluaciones clínicas
      triage: 'I',
      tipo_cama: 'UCI',
      ecg_alterado: true,
      dreo: true,
      dva: false,
      compromiso_conciencia: false,
      rnm_protocol_stroke: false,

      // Procedimientos
      pcr: false,
      cirugia: false,
      cirugia_same_day: false,
      hemodinamia: true,
      hemodinamia_same_day: true,
      endoscopia: false,
      endoscopia_same_day: false,
      dialisis: false,
      trombolisis: false,
      trombolisis_same_day: false,
      transfusiones: '0',
    },
    leve: {
      // Identificación del episodio
      episodio: 'EP-2024-TEST-002',
      centro: 'Centro de Salud Familiar San Martín',
      fecha_ingreso: new Date().toISOString().slice(0, 16),

      // Datos del paciente
      nombre_paciente: 'María López',
      edad: '34',
      sexo: 'F',
      email_paciente: 'maria.lopez@email.com',

      // Previsión
      prevision: 'Isapre',
      nombre_isapre: 'Banmédica',

      // Diagnóstico
      diagnostico_principal: 'Gastroenteritis aguda',
      sintomas: 'Dolor abdominal leve, náuseas, sin vómitos, sin fiebre',
      historia_clinica: 'Sin antecedentes relevantes, cuadro de 12 horas',
      descripcion_adicional: 'Hidratación oral conservada, estado general bueno',

      // Signos vitales
      pa_sistolica: '115',
      pa_diastolica: '72',
      fc: '82',
      fr: '16',
      temperatura_c: '36.7',
      sat_o2: '98',
      glasgow: '15',

      // Soporte respiratorio
      fio2: '',
      fio2_ge_50: false,
      vm: false,

      // Antecedentes médicos
      antecedentes_cardiacos: false,
      antecedentes_diabeticos: false,
      antecedentes_hta: false,

      // Laboratorio
      hb: '',
      creatinina: '',
      bun: '',
      sodio: '',
      potasio: '',
      troponinas_alteradas: false,

      // Evaluaciones clínicas
      triage: 'IV',
      tipo_cama: 'Ambulatoria',
      ecg_alterado: false,
      dreo: false,
      dva: false,
      compromiso_conciencia: false,
      rnm_protocol_stroke: false,

      // Procedimientos
      pcr: false,
      cirugia: false,
      cirugia_same_day: false,
      hemodinamia: false,
      hemodinamia_same_day: false,
      endoscopia: false,
      endoscopia_same_day: false,
      dialisis: false,
      trombolisis: false,
      trombolisis_same_day: false,
      transfusiones: '0',
    },
    intermedio: {
      episodio: 'EP-2024-TEST-003',
      centro: 'Clínica Providencia',
      fecha_ingreso: new Date().toISOString().slice(0, 16),

      nombre_paciente: 'Carlos Muñoz',
      edad: '58',
      sexo: 'M',
      email_paciente: 'carlos.munoz@email.com',

      // Previsión
      prevision: 'Fonasa',
      nombre_isapre: '',

      diagnostico_principal: 'Dolor torácico atípico con factores de riesgo cardiovascular',
      sintomas: 'Dolor torácico leve-moderado, sin irradiación clara, ligero mareo',
      historia_clinica: 'HTA controlada, ex fumador, dislipidemia en tratamiento',
      descripcion_adicional: 'Dolor inició hace 4 horas, responde parcialmente a reposo',

      pa_sistolica: '105',
      pa_diastolica: '68',
      fc: '105',
      fr: '20',
      temperatura_c: '37.2',
      sat_o2: '94',
      glasgow: '15',

      fio2: '28',
      fio2_ge_50: false,
      vm: false,

      antecedentes_cardiacos: true,
      antecedentes_diabeticos: false,
      antecedentes_hta: true,

      hb: '13.2',
      creatinina: '1.0',
      bun: '19',
      sodio: '138',
      potasio: '4.4',
      troponinas_alteradas: false,

      triage: 'II',
      tipo_cama: 'Intermedio',
      ecg_alterado: true,
      dreo: false,
      dva: false,
      compromiso_conciencia: false,
      rnm_protocol_stroke: false,

      pcr: false,
      cirugia: false,
      cirugia_same_day: false,
      hemodinamia: false,
      hemodinamia_same_day: false,
      endoscopia: false,
      endoscopia_same_day: false,
      dialisis: false,
      trombolisis: false,
      trombolisis_same_day: false,
      transfusiones: '0',
    }
  } as const;
  const [formData, setFormData] = useState({
    // Identificación del episodio
    episodio: '',
    centro: '',
    fecha_ingreso: '',

    // Datos del paciente
    nombre_paciente: '',
    edad: '',
    sexo: '',
    email_paciente: '',

    // Previsión
    prevision: '',
    nombre_isapre: '',

    // Diagnóstico
    diagnostico_principal: '',
    sintomas: '',
    historia_clinica: '',
    descripcion_adicional: '',

    // Signos vitales básicos
    pa_sistolica: '',
    pa_diastolica: '',
    fc: '',
    fr: '',
    temperatura_c: '',
    sat_o2: '',
    glasgow: '',

    // Soporte respiratorio
    fio2: '',
    fio2_ge_50: false,
    vm: false,

    // Antecedentes médicos
    antecedentes_cardiacos: false,
    antecedentes_diabeticos: false,
    antecedentes_hta: false,

    // Laboratorio
    hb: '',
    creatinina: '',
    bun: '',
    sodio: '',
    potasio: '',
    troponinas_alteradas: false,

    // Evaluaciones clínicas
    triage: '',
    tipo_cama: '',
    ecg_alterado: false,
    dreo: false,
    dva: false,
    compromiso_conciencia: false,
    rnm_protocol_stroke: false,

    // Procedimientos
    pcr: false,
    cirugia: false,
    cirugia_same_day: false,
    hemodinamia: false,
    hemodinamia_same_day: false,
    endoscopia: false,
    endoscopia_same_day: false,
    dialisis: false,
    trombolisis: false,
    trombolisis_same_day: false,
    transfusiones: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fillWithTestData = (datasetKey: keyof typeof testDatasets = 'critico') => {
    const dataset = testDatasets[datasetKey];
    setFormData(dataset);
    const datasetLabels: Record<keyof typeof testDatasets, string> = {
      critico: 'Crítico (aplica)',
      leve: 'Leve (probable rechazo)',
      intermedio: 'Intermedio (dudoso)',
    };
    toast({
      title: 'Datos de prueba cargados',
      description: `Se cargó el set: ${datasetLabels[datasetKey]}`,
    });
  };

  const validateForm = () => {
    const validationErrors: Record<string, string> = {};

    // Validaciones básicas requeridas
    if (formData.fecha_ingreso) {
      const parsedDate = new Date(formData.fecha_ingreso);
      if (Number.isNaN(parsedDate.getTime())) {
        validationErrors.fecha_ingreso = 'Fecha de ingreso inválida';
      }
    }
    if (!formData.episodio.trim()) {
      validationErrors.episodio = 'El ID del episodio es requerido';
    }
    if (!formData.centro.trim()) {
      validationErrors.centro = 'El centro hospitalario es requerido';
    }
    if (!formData.nombre_paciente.trim() || formData.nombre_paciente.length < 4) {
      validationErrors.nombre_paciente = 'El nombre debe tener al menos 4 caracteres';
    }
    if (!formData.edad || Number(formData.edad) <= 0 || Number(formData.edad) > 120) {
      validationErrors.edad = 'Ingresa una edad válida entre 1 y 120 años';
    }
    if (!formData.sexo) {
      validationErrors.sexo = 'Selecciona el sexo del paciente';
    }
    if (!formData.diagnostico_principal.trim() || formData.diagnostico_principal.length < 10) {
      validationErrors.diagnostico_principal = 'El diagnóstico debe tener al menos 10 caracteres';
    }

    // Textos opcionales con longitudes mínimas
    if (formData.sintomas && formData.sintomas.trim().length < 10) {
      validationErrors.sintomas = 'Los síntomas deben tener al menos 10 caracteres';
    }
    if (formData.historia_clinica && formData.historia_clinica.trim().length < 5) {
      validationErrors.historia_clinica = 'La historia clínica debe tener al menos 5 caracteres';
    }

    // Validaciones opcionales de rangos
    if (formData.pa_sistolica && (Number(formData.pa_sistolica) < 70 || Number(formData.pa_sistolica) > 250)) {
      validationErrors.pa_sistolica = 'Presión sistólica debe estar entre 70 y 250 mmHg';
    }
    if (formData.pa_diastolica && (Number(formData.pa_diastolica) < 40 || Number(formData.pa_diastolica) > 150)) {
      validationErrors.pa_diastolica = 'Presión diastólica debe estar entre 40 y 150 mmHg';
    }
    if (formData.fc && (Number(formData.fc) < 30 || Number(formData.fc) > 220)) {
      validationErrors.fc = 'Frecuencia cardíaca debe estar entre 30 y 220 lpm';
    }
    if (formData.fr && (Number(formData.fr) < 8 || Number(formData.fr) > 40)) {
      validationErrors.fr = 'Frecuencia respiratoria debe estar entre 8 y 40 rpm';
    }
    if (formData.temperatura_c && (Number(formData.temperatura_c) < 30 || Number(formData.temperatura_c) > 45)) {
      validationErrors.temperatura_c = 'Temperatura debe estar entre 30 y 45 °C';
    }
    if (formData.sat_o2 && (Number(formData.sat_o2) < 70 || Number(formData.sat_o2) > 100)) {
      validationErrors.sat_o2 = 'Saturación de oxígeno debe estar entre 70 y 100%';
    }
    if (formData.glasgow && (Number(formData.glasgow) < 3 || Number(formData.glasgow) > 15)) {
      validationErrors.glasgow = 'Escala de Glasgow debe estar entre 3 y 15';
    }
    if (formData.fio2 && (Number(formData.fio2) < 21 || Number(formData.fio2) > 100)) {
      validationErrors.fio2 = 'FiO2 debe estar entre 21 y 100%';
    }
    if (formData.transfusiones && Number(formData.transfusiones) < 0) {
      validationErrors.transfusiones = 'El número de transfusiones no puede ser negativo';
    }

    return validationErrors;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData({ ...formData, [name]: checked });
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const convertTriageToNumber = (triage: string | number | null | undefined): number | null => {
    if (triage === null || triage === undefined || triage === '') return null;
    if (typeof triage === 'number' && !Number.isNaN(triage)) return triage;

    const map: Record<string, number> = {
      I: 1,
      II: 2,
      III: 3,
      IV: 4,
      V: 5,
    };

    const normalized = map[String(triage).trim().toUpperCase()];
    if (normalized) return normalized;

    const numeric = Number(triage);
    return Number.isNaN(numeric) ? null : numeric;
  };

  const normalizeTransfusionFlag = (value: number | string | boolean | null | undefined): boolean => {
    if (typeof value === 'boolean') return value;
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return false;
    return numeric > 0;
  };

  const normalizeFechaIngreso = (fecha: string | null | undefined) => {
    if (!fecha) return new Date().toISOString();
    const parsed = new Date(fecha);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  };

  const formatDateForInput = (fecha: string | null | undefined) => {
    if (!fecha) return '';
    const parsed = new Date(fecha);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 16);
  };

  const loadExistingCase = async (caseId: string) => {
    setPrefilling(true);
    try {
      const { data, error } = await supabase
        .from('casos')
        .select('*')
        .eq('id', caseId)
        .single();

      const caso = data as CasoRowExpanded | null;

      if (error || !caso) {
        throw error || new Error('No se encontró el caso solicitado');
      }

      setFormData({
        episodio: caso.episodio || '',
        centro: caso.centro || '',
        fecha_ingreso: formatDateForInput(caso.fecha_ingreso),

        nombre_paciente: caso.nombre_paciente || '',
        edad: caso.edad_paciente?.toString() || '',
        sexo: caso.sexo_paciente || '',
        email_paciente: caso.email_paciente || '',

        prevision: (caso as any).prevision || '',
        nombre_isapre: (caso as any).nombre_isapre || '',

        diagnostico_principal: caso.diagnostico_principal || '',
        sintomas: caso.sintomas || '',
        historia_clinica: caso.historia_clinica || '',
        descripcion_adicional: caso.descripcion_adicional || '',

        pa_sistolica: caso.pa_sistolica?.toString() || '',
        pa_diastolica: caso.pa_diastolica?.toString() || '',
        fc: caso.fc?.toString() || '',
        fr: caso.fr?.toString() || '',
        temperatura_c: caso.temperatura_c?.toString() || '',
        sat_o2: caso.sat_o2?.toString() || '',
        glasgow: caso.glasgow?.toString() || '',

        fio2: caso.fio2?.toString() || '',
        fio2_ge_50: Boolean(caso.fio2_ge_50),
        vm: Boolean(caso.vm),

        antecedentes_cardiacos: Boolean(caso.antecedentes_cardiacos),
        antecedentes_diabeticos: Boolean(caso.antecedentes_diabeticos),
        antecedentes_hta: Boolean(caso.antecedentes_hta),

        hb: caso.hb?.toString() || '',
        creatinina: caso.creatinina?.toString() || '',
        bun: caso.bun?.toString() || '',
        sodio: caso.sodio?.toString() || '',
        potasio: caso.potasio?.toString() || '',
        troponinas_alteradas: Boolean(caso.troponinas_alteradas),

        triage: caso.triage ? caso.triage.toString() : '',
        tipo_cama: caso.tipo_cama || '',
        ecg_alterado: Boolean(caso.ecg_alterado),
        dreo: Boolean(caso.dreo),
        dva: Boolean(caso.dva),
        compromiso_conciencia: Boolean(caso.compromiso_conciencia),
        rnm_protocol_stroke: Boolean(caso.rnm_protocol_stroke),

        pcr: Boolean(caso.pcr),
        cirugia: Boolean(caso.cirugia),
        cirugia_same_day: Boolean(caso.cirugia_same_day),
        hemodinamia: Boolean(caso.hemodinamia),
        hemodinamia_same_day: Boolean(caso.hemodinamia_same_day),
        endoscopia: Boolean(caso.endoscopia),
        endoscopia_same_day: Boolean(caso.endoscopia_same_day),
        dialisis: Boolean(caso.dialisis),
        trombolisis: Boolean(caso.trombolisis),
        trombolisis_same_day: Boolean(caso.trombolisis_same_day),
        transfusiones: caso.transfusiones?.toString() || '',
      });
      setErrors({});
    } catch (error: any) {
      toast({
        title: 'Error al cargar caso',
        description: error.message || 'No se pudo cargar la información del caso',
        variant: 'destructive',
      });
      navigate('/dashboard');
    } finally {
      setPrefilling(false);
    }
  };

  useEffect(() => {
    if (isEditing && editingCaseId) {
      loadExistingCase(editingCaseId);
    }
  }, [isEditing, editingCaseId]);

  const performEvaluation = async (casoId: string, casoData: any, method: string) => {
    let endpoint = '';
    try {
      const triageNumber = convertTriageToNumber(casoData.triage);
      const fechaIngreso = normalizeFechaIngreso(casoData.fecha_ingreso);

      // Base data usada para todos los métodos
      const baseData = {
        // Campos requeridos - asegurar que no estén vacíos
        episodio: (casoData.episodio || `EP-${Date.now()}`).toString(),
        centro: (casoData.centro || 'Centro sin especificar').toString(),
        fecha_ingreso: fechaIngreso,
        diagnostico: casoData.diagnostico_principal || 'Diagnóstico pendiente',

        // Signos vitales
        pa_sistolica: casoData.pa_sistolica ?? null,
        pa_diastolica: casoData.pa_diastolica ?? null,
        pa_media: casoData.pa_media ?? null,
        fc: casoData.fc ?? null,
        fr: casoData.fr ?? null,
        temperatura_c: casoData.temperatura_c ?? null,
        sat_o2: casoData.sat_o2 ?? null,
        glasgow: casoData.glasgow ?? null,

        // Soporte respiratorio
        fio2: casoData.fio2 ?? null,
        fio2_ge_50: casoData.fio2_ge_50 ?? false,
        vm: casoData.vm ?? false,

        // Antecedentes
        antecedentes_cardiacos: casoData.antecedentes_cardiacos ?? false,
        antecedentes_diabeticos: casoData.antecedentes_diabeticos ?? false,
        antecedentes_hta: casoData.antecedentes_hta ?? false,

        // Laboratorio
        hb: casoData.hb ?? null,
        creatinina: casoData.creatinina ?? null,
        bun: casoData.bun ?? null,
        sodio: casoData.sodio ?? null,
        potasio: casoData.potasio ?? null,
        troponinas_alteradas: casoData.troponinas_alteradas ?? false,

        // Evaluaciones clínicas - CORREGIR TIPOS
        triage: triageNumber,
        tipo_cama: casoData.tipo_cama || null,
        ecg_alterado: casoData.ecg_alterado ?? false,
        dreo: casoData.dreo ?? false,
        dva: casoData.dva ?? false,
        compromiso_conciencia: casoData.compromiso_conciencia ?? false,
        rnm_protocol_stroke: casoData.rnm_protocol_stroke ?? false,

        // Procedimientos - CORREGIR TIPOS
        pcr: casoData.pcr ? 1 : 0, // Backend espera número en rules
        cirugia: casoData.cirugia ?? false,
        cirugia_same_day: casoData.cirugia_same_day ?? false,
        hemodinamia: casoData.hemodinamia ?? false,
        hemodinamia_same_day: casoData.hemodinamia_same_day ?? false,
        endoscopia: casoData.endoscopia ?? false,
        endoscopia_same_day: casoData.endoscopia_same_day ?? false,
        dialisis: casoData.dialisis ?? false,
        trombolisis: casoData.trombolisis ?? false,
        trombolisis_same_day: casoData.trombolisis_same_day ?? false,
        transfusiones: normalizeTransfusionFlag(casoData.transfusiones), // Backend espera boolean para reglas
      };

      if (method === 'rules') {
        endpoint = '/api/emergency/evaluate?patient_type=adult';
      } else if (method === 'grok' || method === 'openai' || method === 'gemini') {
        endpoint = `/api/multi-llm/evaluate/${method}`;
      } else {
        throw new Error(`Método de evaluación no soportado: ${method}`);
      }

      const response = await fetch(`${EVALUATION_CONFIG.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          method === 'rules'
            ? baseData // rules espera campos en el root del body
            : {
                data: baseData,
                patient_type: 'adult',
                provider: method,
              }
        ),
      });

      const responseText = await response.text();
      let result;

      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Error parsing response: ${responseText.substring(0, 200)}...`);
      }

      if (!response.ok) {
        const errorMessage = result?.error || result?.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      if (result.success === false) {
        throw new Error(result.error || result.message || 'Error en la evaluación');
      }

      const payload = result?.data ?? result?.result ?? result;

      // Guardar resultado en la base de datos
      await saveEvaluationResult(casoId, payload, method);

      return { success: true, result: payload };
    } catch (error: any) {
      consoleLogDebugger('Error en evaluación:', {
        method,
        endpoint,
        error: error.message,
        stack: error.stack
      });
      
      // Mejorar el mensaje de error para "Failed to fetch"
      let errorMessage = error.message;
      if (error.message === 'Failed to fetch' || error.message.includes('Failed to fetch')) {
        errorMessage = 'No se pudo conectar con el servidor de evaluación. Por favor, verifica tu conexión a internet o intenta más tarde.';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const saveEvaluationResult = async (casoId: string, result: any, method: string) => {
    try {
      console.log('Guardando resultado:', { casoId, result, method });

      const payload = result?.data ?? result?.result ?? result;
      let sugerencia: 'aceptar' | 'rechazar' | 'incierto' = 'incierto';
      let confianza = 50;
      let explicacion = '';

      if (method === 'rules') {
        // Resultado del motor de reglas
        const applies = payload?.applies;

        if (applies === undefined || applies === null) {
          sugerencia = 'incierto';
          confianza = 50;
          explicacion = 'Motor de reglas no retornó el campo "applies".';
        } else {
          sugerencia = applies ? 'aceptar' : 'rechazar';
          confianza = 95; // Reglas son determinísticas
          explicacion = `Motor de Reglas: ${applies ? 'APLICA' : 'NO APLICA'} Ley de Urgencia.`;
        }

        const evidence = payload?.evidence;
        const clusters = payload?.clusters;
        const appliedRules = payload?.applied_rules;
        const ruleDetails = payload?.rule_details ?? payload?.evaluation_criteria;

        if (evidence?.length) {
          explicacion += `${explicacion ? ' ' : ''}Criterios cumplidos: ${evidence.join(', ')}.`;
        }

        if (clusters?.length) {
          explicacion += `${explicacion ? ' ' : ''}Clusters: ${clusters.join(', ')}.`;
        }

        if (appliedRules?.length) {
          explicacion += `${explicacion ? ' ' : ''}Reglas aplicadas: ${appliedRules.join(', ')}.`;
        }

        if (ruleDetails?.score !== undefined) {
          explicacion += `${explicacion ? ' ' : ''}Score: ${ruleDetails.score}.`;
        }

        if (ruleDetails?.triggered_rules?.length) {
          explicacion += `${explicacion ? ' ' : ''}Reglas activadas: ${ruleDetails.triggered_rules.join(', ')}.`;
        }
      } else {
        // Resultado de LLM
        sugerencia = payload.applies ? 'aceptar' : 'rechazar';
        confianza = Math.round((payload.confidence || 0.5) * 100);

        const explicacionParts: string[] = [];

        if (payload.reasoning) {
          const reasoning = payload.reasoning.length > 800
            ? `${payload.reasoning.substring(0, 800)}...`
            : payload.reasoning;
          explicacionParts.push(reasoning);
        }

        if (payload.evidence?.length) {
          explicacionParts.push(`- <strong>Evidencias:</strong> ${payload.evidence.join(', ')}.`);
        }

        if (payload.risk_factors?.length) {
          explicacionParts.push(`- <strong>Factores de riesgo:</strong> ${payload.risk_factors.join(', ')}.`);
        }

        if (payload.recommendations?.length) {
          const recs = payload.recommendations.slice(0, 3).join(', ');
          const hasMore = payload.recommendations.length > 3 ? '...' : '';
          explicacionParts.push(`- <strong>Recomendaciones:</strong> ${recs}${hasMore}.`);
        }

        explicacion = explicacionParts.join('\n\n');
      }

      // Limitar la explicación a un tamaño razonable para la base de datos
      if (explicacion.length > 4000) {
        explicacion = explicacion.substring(0, 4000) + '...';
      }

      const insertData = {
        caso_id: casoId,
        sugerencia: sugerencia,
        confianza: confianza,
        explicacion: explicacion,
      };

      console.log('Insertando en sugerencia_ia:', insertData);

      const { error } = await supabase
        .from('sugerencia_ia')
        .insert([insertData]);

      if (error) {
        console.error('Error de Supabase:', error);
        throw error;
      }

      console.log('Resultado guardado exitosamente');
    } catch (error: any) {
      console.error('Error guardando resultado:', {
        casoId,
        method,
        error: error.message,
        details: error
      });
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar todo el formulario antes de enviar
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast({
        title: 'Revisa los datos ingresados',
        description: 'Corrige los campos marcados para continuar.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const methodLabel =
        evaluationMethod === 'rules' ? 'Motor de Reglas' :
        evaluationMethod === 'grok' ? 'Grok' :
        evaluationMethod === 'openai' ? 'OpenAI' :
        evaluationMethod === 'gemini' ? 'Gemini' : 'IA';
      const resolvedEpisodio = formData.episodio.trim() || `EP-${Date.now()}`;
      const resolvedCentro = formData.centro.trim() || 'Centro sin especificar';
      const resolvedFechaIngreso = normalizeFechaIngreso(formData.fecha_ingreso);

      const baseCasoData = {
        // Identificación
        episodio: resolvedEpisodio,
        centro: resolvedCentro,
        fecha_ingreso: resolvedFechaIngreso,

        // Datos del paciente
        nombre_paciente: formData.nombre_paciente.trim(),
        edad_paciente: parseInt(formData.edad),
        sexo_paciente: formData.sexo,
        email_paciente: formData.email_paciente.trim() || null,

        // Previsión
        prevision: formData.prevision || null,
        nombre_isapre: (formData.prevision === 'Isapre' && formData.nombre_isapre.trim()) ? formData.nombre_isapre.trim() : null,

        // Diagnóstico
        diagnostico_principal: formData.diagnostico_principal.trim(),
        sintomas: formData.sintomas.trim() || null,
        historia_clinica: formData.historia_clinica.trim() || null,
        descripcion_adicional: formData.descripcion_adicional.trim() || null,

        // Signos vitales
        pa_sistolica: formData.pa_sistolica ? parseInt(formData.pa_sistolica) : null,
        pa_diastolica: formData.pa_diastolica ? parseInt(formData.pa_diastolica) : null,
        pa_media: (formData.pa_sistolica && formData.pa_diastolica) ?
          Math.round((parseInt(formData.pa_diastolica) * 2 + parseInt(formData.pa_sistolica)) / 3) : null,
        fc: formData.fc ? parseInt(formData.fc) : null,
        fr: formData.fr ? parseInt(formData.fr) : null,
        temperatura_c: formData.temperatura_c ? parseFloat(formData.temperatura_c) : null,
        sat_o2: formData.sat_o2 ? parseInt(formData.sat_o2) : null,
        glasgow: formData.glasgow ? parseInt(formData.glasgow) : null,

        // Soporte respiratorio
        fio2: formData.fio2 ? parseInt(formData.fio2) : null,
        fio2_ge_50: formData.fio2_ge_50,
        vm: formData.vm,

        // Antecedentes
        antecedentes_cardiacos: formData.antecedentes_cardiacos,
        antecedentes_diabeticos: formData.antecedentes_diabeticos,
        antecedentes_hta: formData.antecedentes_hta,

        // Laboratorio
        hb: formData.hb ? parseFloat(formData.hb) : null,
        creatinina: formData.creatinina ? parseFloat(formData.creatinina) : null,
        bun: formData.bun ? parseFloat(formData.bun) : null,
        sodio: formData.sodio ? parseFloat(formData.sodio) : null,
        potasio: formData.potasio ? parseFloat(formData.potasio) : null,
        troponinas_alteradas: formData.troponinas_alteradas,

        // Evaluaciones clínicas
        triage: formData.triage || null,
        tipo_cama: formData.tipo_cama || null,
        ecg_alterado: formData.ecg_alterado,
        dreo: formData.dreo,
        dva: formData.dva,
        compromiso_conciencia: formData.compromiso_conciencia,
        rnm_protocol_stroke: formData.rnm_protocol_stroke,

        // Procedimientos
        pcr: formData.pcr,
        cirugia: formData.cirugia,
        cirugia_same_day: formData.cirugia_same_day,
        hemodinamia: formData.hemodinamia,
        hemodinamia_same_day: formData.hemodinamia_same_day,
        endoscopia: formData.endoscopia,
        endoscopia_same_day: formData.endoscopia_same_day,
        dialisis: formData.dialisis,
        trombolisis: formData.trombolisis,
        trombolisis_same_day: formData.trombolisis_same_day,
        transfusiones: formData.transfusiones ? parseInt(formData.transfusiones) : null,
      };

      if (isEditing && editingCaseId) {
        const { error: updateError } = await supabase
          .from('casos')
          .update(baseCasoData)
          .eq('id', editingCaseId);

        if (updateError) throw updateError;

        const evaluationResult = await performEvaluation(editingCaseId, baseCasoData, evaluationMethod);

        if (evaluationResult.success) {
          toast({
            title: 'Caso actualizado y reevaluado exitosamente',
            description: `Evaluación completada con ${methodLabel}`,
          });
          setErrors({});
          navigate(`/caso/${editingCaseId}`);
        } else {
          // El caso se guardó correctamente, pero la evaluación falló
          toast({
            title: 'Caso actualizado',
            description: `El caso se actualizó correctamente, pero no se pudo completar la evaluación: ${evaluationResult.error || 'Error desconocido'}. Puedes intentar evaluar nuevamente desde la vista del caso.`,
            variant: 'default',
          });
          setErrors({});
          navigate(`/caso/${editingCaseId}`);
        }
      } else {
        const insertData = {
          ...baseCasoData,
          medico_tratante_id: user?.id,
          estado: 'pendiente',
        };

        const { data: caso, error: casoError } = await supabase
          .from('casos')
          // Tipado laxo hasta regenerar tipos de Supabase con los nuevos campos
          .insert([insertData as any])
          .select()
          .single();

        if (casoError) throw casoError;

        const evaluationResult = await performEvaluation(caso.id, insertData, evaluationMethod);

        if (evaluationResult.success) {
          toast({
            title: 'Caso creado y evaluado exitosamente',
            description: `Evaluación completada con ${methodLabel}`,
          });
          setErrors({});
          navigate(`/caso/${caso.id}`);
        } else {
          throw new Error(evaluationResult.error || 'Error en la evaluación');
        }
      }
    } catch (error: any) {
      toast({
        title: isEditing ? 'Error al actualizar caso' : 'Error al crear caso',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      setProgress(0);
      return;
    }

    setProgress(10);
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95;
        return prev + 5;
      });
    }, 400);

    return () => clearInterval(timer);
  }, [loading]);

  if (prefilling) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Cargando caso...</p>
      </div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-gradient-to-r from-primary to-secondary text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(isEditing && editingCaseId ? `/caso/${editingCaseId}` : '/dashboard')}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-2xl font-bold">{isEditing ? 'Editar Caso Clínico' : 'Nuevo Caso Clínico'}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle>Datos del Paciente y Caso Clínico</CardTitle>
            <CardDescription>
              Complete la información del paciente y los datos clínicos para evaluar la Ley de Urgencia
            </CardDescription>
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => fillWithTestData('critico')}
                disabled={loading}
                className="flex items-center gap-2"
              >
                Llenar con datos de prueba (Crítico)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fillWithTestData('leve')}
                disabled={loading}
                className="flex items-center gap-2"
              >
                Llenar con datos de prueba (Leve)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fillWithTestData('intermedio')}
                disabled={loading}
                className="flex items-center gap-2"
              >
                Llenar con datos de prueba (Intermedio)
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Identificación del Episodio */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary border-b pb-2">Identificación del Episodio</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="episodio">ID del Episodio *</Label>
                    <Input
                      id="episodio"
                      name="episodio"
                      value={formData.episodio}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="EP-2024-001"
                      className={errors.episodio ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.episodio && <p className="text-sm text-destructive">{errors.episodio}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="centro">Centro Hospitalario *</Label>
                    <Input
                      id="centro"
                      name="centro"
                      value={formData.centro}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Hospital Regional de Santiago"
                      className={errors.centro ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.centro && <p className="text-sm text-destructive">{errors.centro}</p>}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="fecha_ingreso">Fecha y Hora de Ingreso</Label>
                    <Input
                      id="fecha_ingreso"
                      name="fecha_ingreso"
                      type="datetime-local"
                      value={formData.fecha_ingreso}
                      onChange={handleChange}
                      disabled={loading}
                      className={errors.fecha_ingreso ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.fecha_ingreso && <p className="text-sm text-destructive">{errors.fecha_ingreso}</p>}
                  </div>
                </div>
              </div>

              {/* Datos del Paciente */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary border-b pb-2">Datos del Paciente</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre_paciente">Nombre Completo *</Label>
                    <Input
                      id="nombre_paciente"
                      name="nombre_paciente"
                      value={formData.nombre_paciente}
                      onChange={handleChange}
                      disabled={loading}
                      className={errors.nombre_paciente ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.nombre_paciente && <p className="text-sm text-destructive">{errors.nombre_paciente}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edad">Edad *</Label>
                    <Input
                      id="edad"
                      name="edad"
                      type="number"
                      value={formData.edad}
                      onChange={handleChange}
                      disabled={loading}
                      className={errors.edad ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.edad && <p className="text-sm text-destructive">{errors.edad}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sexo">Sexo *</Label>
                    <Select
                      value={formData.sexo}
                      onValueChange={(value) => handleSelectChange('sexo', value)}
                      disabled={loading}
                    >
                      <SelectTrigger className={errors.sexo ? 'border-destructive focus-visible:ring-destructive' : undefined}>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Femenino</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.sexo && <p className="text-sm text-destructive">{errors.sexo}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email_paciente">Email del Paciente</Label>
                    <Input
                      id="email_paciente"
                      name="email_paciente"
                      type="email"
                      value={formData.email_paciente}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="paciente@email.com"
                      className={errors.email_paciente ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.email_paciente && <p className="text-sm text-destructive">{errors.email_paciente}</p>}
                  </div>
                </div>
              </div>

              {/* Previsión */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary border-b pb-2">Previsión de Salud</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prevision">Tipo de Previsión</Label>
                    <Select
                      value={formData.prevision}
                      onValueChange={(value) => {
                        handleSelectChange('prevision', value);
                        // Limpiar nombre de isapre si se cambia a Fonasa
                        if (value === 'Fonasa') {
                          setFormData(prev => ({ ...prev, nombre_isapre: '' }));
                        }
                      }}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar previsión" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fonasa">Fonasa</SelectItem>
                        <SelectItem value="Isapre">Isapre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.prevision === 'Isapre' && (
                    <div className="space-y-2">
                      <Label htmlFor="nombre_isapre">Nombre de la Isapre</Label>
                      <Input
                        id="nombre_isapre"
                        name="nombre_isapre"
                        value={formData.nombre_isapre}
                        onChange={handleChange}
                        disabled={loading}
                        placeholder="Ej: Banmédica, Cruz Blanca, Consalud"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Diagnóstico */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary border-b pb-2">Diagnóstico Clínico</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="diagnostico_principal">Diagnóstico Principal *</Label>
                    <Input
                      id="diagnostico_principal"
                      name="diagnostico_principal"
                      value={formData.diagnostico_principal}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Infarto agudo de miocardio"
                      className={errors.diagnostico_principal ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.diagnostico_principal && <p className="text-sm text-destructive">{errors.diagnostico_principal}</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sintomas">Síntomas</Label>
                      <Textarea
                        id="sintomas"
                        name="sintomas"
                        value={formData.sintomas}
                        onChange={handleChange}
                        disabled={loading}
                        rows={3}
                        placeholder="Dolor torácico opresivo, disnea, sudoración..."
                        className={errors.sintomas ? 'border-destructive focus-visible:ring-destructive' : undefined}
                      />
                      {errors.sintomas && <p className="text-sm text-destructive">{errors.sintomas}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="historia_clinica">Historia Clínica</Label>
                      <Textarea
                        id="historia_clinica"
                        name="historia_clinica"
                        value={formData.historia_clinica}
                        onChange={handleChange}
                        disabled={loading}
                        rows={3}
                        placeholder="Antecedentes médicos relevantes..."
                        className={errors.historia_clinica ? 'border-destructive focus-visible:ring-destructive' : undefined}
                      />
                      {errors.historia_clinica && <p className="text-sm text-destructive">{errors.historia_clinica}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descripcion_adicional">Descripción Adicional</Label>
                    <Textarea
                      id="descripcion_adicional"
                      name="descripcion_adicional"
                      value={formData.descripcion_adicional}
                      onChange={handleChange}
                      disabled={loading}
                      rows={2}
                      placeholder="Información adicional relevante..."
                      className={errors.descripcion_adicional ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.descripcion_adicional && <p className="text-sm text-destructive">{errors.descripcion_adicional}</p>}
                  </div>
                </div>
              </div>

              {/* Signos Vitales */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary border-b pb-2">Signos Vitales</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pa_sistolica">PA Sistólica (mmHg)</Label>
                    <Input
                      id="pa_sistolica"
                      name="pa_sistolica"
                      type="number"
                      value={formData.pa_sistolica}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="120"
                      className={errors.pa_sistolica ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.pa_sistolica && <p className="text-sm text-destructive">{errors.pa_sistolica}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pa_diastolica">PA Diastólica (mmHg)</Label>
                    <Input
                      id="pa_diastolica"
                      name="pa_diastolica"
                      type="number"
                      value={formData.pa_diastolica}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="80"
                      className={errors.pa_diastolica ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.pa_diastolica && <p className="text-sm text-destructive">{errors.pa_diastolica}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fc">FC (lpm)</Label>
                    <Input
                      id="fc"
                      name="fc"
                      type="number"
                      value={formData.fc}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="80"
                      className={errors.fc ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.fc && <p className="text-sm text-destructive">{errors.fc}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fr">FR (rpm)</Label>
                    <Input
                      id="fr"
                      name="fr"
                      type="number"
                      value={formData.fr}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="18"
                      className={errors.fr ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.fr && <p className="text-sm text-destructive">{errors.fr}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperatura_c">Temperatura (°C)</Label>
                    <Input
                      id="temperatura_c"
                      name="temperatura_c"
                      type="number"
                      step="0.1"
                      value={formData.temperatura_c}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="36.5"
                      className={errors.temperatura_c ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.temperatura_c && <p className="text-sm text-destructive">{errors.temperatura_c}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sat_o2">SatO2 (%)</Label>
                    <Input
                      id="sat_o2"
                      name="sat_o2"
                      type="number"
                      value={formData.sat_o2}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="98"
                      className={errors.sat_o2 ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.sat_o2 && <p className="text-sm text-destructive">{errors.sat_o2}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="glasgow">Glasgow (3-15)</Label>
                    <Input
                      id="glasgow"
                      name="glasgow"
                      type="number"
                      min="3"
                      max="15"
                      value={formData.glasgow}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="15"
                      className={errors.glasgow ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    />
                    {errors.glasgow && <p className="text-sm text-destructive">{errors.glasgow}</p>}
                  </div>
                </div>
              </div>

              {/* Soporte Respiratorio y Antecedentes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary border-b pb-2">Soporte Respiratorio</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fio2">FiO2 (%)</Label>
                      <Input
                        id="fio2"
                        name="fio2"
                        type="number"
                        min="21"
                        max="100"
                        value={formData.fio2}
                        onChange={handleChange}
                        disabled={loading}
                        placeholder="21"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="fio2_ge_50"
                          checked={formData.fio2_ge_50}
                          onCheckedChange={(checked) => handleCheckboxChange('fio2_ge_50', checked as boolean)}
                          disabled={loading}
                        />
                        <Label htmlFor="fio2_ge_50">FiO2 ≥ 50%</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="vm"
                          checked={formData.vm}
                          onCheckedChange={(checked) => handleCheckboxChange('vm', checked as boolean)}
                          disabled={loading}
                        />
                        <Label htmlFor="vm">Ventilación Mecánica</Label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary border-b pb-2">Antecedentes Médicos</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="antecedentes_cardiacos"
                        checked={formData.antecedentes_cardiacos}
                        onCheckedChange={(checked) => handleCheckboxChange('antecedentes_cardiacos', checked as boolean)}
                        disabled={loading}
                      />
                      <Label htmlFor="antecedentes_cardiacos">Cardiopatía Previa</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="antecedentes_diabeticos"
                        checked={formData.antecedentes_diabeticos}
                        onCheckedChange={(checked) => handleCheckboxChange('antecedentes_diabeticos', checked as boolean)}
                        disabled={loading}
                      />
                      <Label htmlFor="antecedentes_diabeticos">Diabetes Mellitus</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="antecedentes_hta"
                        checked={formData.antecedentes_hta}
                        onCheckedChange={(checked) => handleCheckboxChange('antecedentes_hta', checked as boolean)}
                        disabled={loading}
                      />
                      <Label htmlFor="antecedentes_hta">Hipertensión Arterial</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Laboratorio */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary border-b pb-2">Laboratorio</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hb">Hemoglobina (g/dL)</Label>
                    <Input
                      id="hb"
                      name="hb"
                      type="number"
                      step="0.1"
                      value={formData.hb}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="12.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="creatinina">Creatinina (mg/dL)</Label>
                    <Input
                      id="creatinina"
                      name="creatinina"
                      type="number"
                      step="0.1"
                      value={formData.creatinina}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="1.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bun">BUN (mg/dL)</Label>
                    <Input
                      id="bun"
                      name="bun"
                      type="number"
                      step="0.1"
                      value={formData.bun}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="15"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sodio">Sodio (mEq/L)</Label>
                    <Input
                      id="sodio"
                      name="sodio"
                      type="number"
                      step="0.1"
                      value={formData.sodio}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="140"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="potasio">Potasio (mEq/L)</Label>
                    <Input
                      id="potasio"
                      name="potasio"
                      type="number"
                      step="0.1"
                      value={formData.potasio}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="4.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 pt-6">
                      <Checkbox
                        id="troponinas_alteradas"
                        checked={formData.troponinas_alteradas}
                        onCheckedChange={(checked) => handleCheckboxChange('troponinas_alteradas', checked as boolean)}
                        disabled={loading}
                      />
                      <Label htmlFor="troponinas_alteradas">Troponinas Alteradas</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Evaluaciones Clínicas */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary border-b pb-2">Evaluaciones Clínicas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="triage">Nivel de Triage</Label>
                    <Select
                      value={formData.triage}
                      onValueChange={(value) => handleSelectChange('triage', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar nivel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="I">Nivel I - Crítico</SelectItem>
                        <SelectItem value="II">Nivel II - Emergente</SelectItem>
                        <SelectItem value="III">Nivel III - Urgente</SelectItem>
                        <SelectItem value="IV">Nivel IV - Semi-urgente</SelectItem>
                        <SelectItem value="V">Nivel V - No urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo_cama">Tipo de Cama</Label>
                    <Input
                      id="tipo_cama"
                      name="tipo_cama"
                      value={formData.tipo_cama}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="UCI, Intermedio, Básica..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ecg_alterado"
                      checked={formData.ecg_alterado}
                      onCheckedChange={(checked) => handleCheckboxChange('ecg_alterado', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="ecg_alterado">ECG Alterado</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dreo"
                      checked={formData.dreo}
                      onCheckedChange={(checked) => handleCheckboxChange('dreo', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="dreo">Drogas Vasoactivas</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dva"
                      checked={formData.dva}
                      onCheckedChange={(checked) => handleCheckboxChange('dva', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="dva">DVA Específicas</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="compromiso_conciencia"
                      checked={formData.compromiso_conciencia}
                      onCheckedChange={(checked) => handleCheckboxChange('compromiso_conciencia', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="compromiso_conciencia">Compromiso de Conciencia</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rnm_protocol_stroke"
                      checked={formData.rnm_protocol_stroke}
                      onCheckedChange={(checked) => handleCheckboxChange('rnm_protocol_stroke', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="rnm_protocol_stroke">Protocolo RNM Stroke</Label>
                  </div>
                </div>
              </div>

              {/* Procedimientos */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary border-b pb-2">Procedimientos</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pcr"
                      checked={formData.pcr}
                      onCheckedChange={(checked) => handleCheckboxChange('pcr', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="pcr">Parada Cardiorrespiratoria</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cirugia"
                      checked={formData.cirugia}
                      onCheckedChange={(checked) => handleCheckboxChange('cirugia', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="cirugia">Cirugía</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cirugia_same_day"
                      checked={formData.cirugia_same_day}
                      onCheckedChange={(checked) => handleCheckboxChange('cirugia_same_day', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="cirugia_same_day">Cirugía Mismo Día</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hemodinamia"
                      checked={formData.hemodinamia}
                      onCheckedChange={(checked) => handleCheckboxChange('hemodinamia', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="hemodinamia">Hemodinamia</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hemodinamia_same_day"
                      checked={formData.hemodinamia_same_day}
                      onCheckedChange={(checked) => handleCheckboxChange('hemodinamia_same_day', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="hemodinamia_same_day">Hemodinamia Mismo Día</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="endoscopia"
                      checked={formData.endoscopia}
                      onCheckedChange={(checked) => handleCheckboxChange('endoscopia', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="endoscopia">Endoscopia</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="endoscopia_same_day"
                      checked={formData.endoscopia_same_day}
                      onCheckedChange={(checked) => handleCheckboxChange('endoscopia_same_day', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="endoscopia_same_day">Endoscopia Mismo Día</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dialisis"
                      checked={formData.dialisis}
                      onCheckedChange={(checked) => handleCheckboxChange('dialisis', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="dialisis">Diálisis</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="trombolisis"
                      checked={formData.trombolisis}
                      onCheckedChange={(checked) => handleCheckboxChange('trombolisis', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="trombolisis">Trombólisis</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="trombolisis_same_day"
                      checked={formData.trombolisis_same_day}
                      onCheckedChange={(checked) => handleCheckboxChange('trombolisis_same_day', checked as boolean)}
                      disabled={loading}
                    />
                    <Label htmlFor="trombolisis_same_day">Trombólisis Mismo Día</Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transfusiones">Número de Transfusiones</Label>
                    <Input
                      id="transfusiones"
                      name="transfusiones"
                      type="number"
                      min="0"
                      value={formData.transfusiones}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Método de Evaluación */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-primary border-b pb-2">Método de Evaluación</h3>
                <div className="space-y-2">
                  <Select
                    value={evaluationMethod}
                    onValueChange={setEvaluationMethod}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rules">Motor de Reglas (DS N°34/2021)</SelectItem>
                      <SelectItem value="grok">Grok</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="gemini">Gemini Pro</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {evaluationMethod === 'rules' && 'Evaluación determinística basada en criterios del Decreto Supremo N°34/2021'}
                    {evaluationMethod === 'grok' && 'Evaluación con IA usando el modelo grok-4-fast-reasoning de xAI'}
                    {evaluationMethod === 'openai' && 'Evaluación con IA usando OpenAI'}
                    {evaluationMethod === 'gemini' && 'Evaluación con IA usando Gemini'}
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t">
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? 'Evaluando...' : `Evaluar con ${
                    evaluationMethod === 'rules' ? 'Motor de Reglas' :
                    evaluationMethod === 'grok' ? 'Grok' :
                    evaluationMethod === 'openai' ? 'OpenAI' :
                    evaluationMethod === 'gemini' ? 'Gemini' : 'IA'
                  }`}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border p-8 w-11/12 max-w-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Evaluando caso</p>
                <p className="text-xl font-semibold text-primary">Analizando</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <span>Generando sugerencia y explicación...</span>
            </div>

            <div className="space-y-2">
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary via-secondary to-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Este paso puede tomar unos segundos. No cierres la ventana.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
