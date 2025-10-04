import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { ArrowLeft } from 'lucide-react';

export default function NuevoCaso() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    nombre_paciente: '',
    edad: '',
    sexo: '',
    email_paciente: '',
    diagnostico_principal: '',
    sintomas: '',
    historia_clinica: '',
    presion_arterial: '',
    frecuencia_cardiaca: '',
    temperatura: '',
    saturacion_oxigeno: '',
    frecuencia_respiratoria: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: caso, error: casoError } = await supabase
        .from('casos')
        .insert([
          {
            nombre_paciente: formData.nombre_paciente,
            edad_paciente: parseInt(formData.edad),
            sexo_paciente: formData.sexo,
            email_paciente: formData.email_paciente,
            diagnostico_principal: formData.diagnostico_principal,
            sintomas: formData.sintomas,
            historia_clinica: formData.historia_clinica,
            presion_arterial: formData.presion_arterial,
            frecuencia_cardiaca: formData.frecuencia_cardiaca ? parseInt(formData.frecuencia_cardiaca) : null,
            temperatura: formData.temperatura ? parseFloat(formData.temperatura) : null,
            saturacion_oxigeno: formData.saturacion_oxigeno ? parseInt(formData.saturacion_oxigeno) : null,
            frecuencia_respiratoria: formData.frecuencia_respiratoria ? parseInt(formData.frecuencia_respiratoria) : null,
            medico_tratante_id: user?.id,
            estado: 'pendiente',
          },
        ])
        .select()
        .single();

      if (casoError) throw casoError;

      // Generar sugerencia IA simulada
      const sugerenciaRandom = Math.random() > 0.5 ? 'aceptar' : 'rechazar';
      const confianzaRandom = Math.floor(Math.random() * 30) + 70;

      const { error: iaError } = await supabase
        .from('sugerencia_ia')
        .insert([
          {
            caso_id: caso.id,
            sugerencia: sugerenciaRandom,
            confianza: confianzaRandom,
            explicacion: `Basado en el análisis de los datos clínicos ingresados, se sugiere ${sugerenciaRandom === 'aceptar' ? 'aplicar' : 'no aplicar'} la Ley de Urgencia. Criterios evaluados: estado hemodinámico, signos vitales y diagnóstico principal.`,
          },
        ]);

      if (iaError) throw iaError;

      toast({
        title: 'Caso creado exitosamente',
        description: 'El análisis de IA se ha generado',
      });

      navigate(`/caso/${caso.id}`);
    } catch (error: any) {
      toast({
        title: 'Error al crear caso',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="text-2xl font-bold">Nuevo Caso Clínico</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Datos del Paciente y Caso Clínico</CardTitle>
            <CardDescription>
              Ingrese la información del paciente y los datos clínicos para evaluar la Ley de Urgencia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Datos del Paciente */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Datos del Paciente</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre_paciente">Nombre Completo *</Label>
                    <Input
                      id="nombre_paciente"
                      name="nombre_paciente"
                      value={formData.nombre_paciente}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edad">Edad *</Label>
                    <Input
                      id="edad"
                      name="edad"
                      type="number"
                      value={formData.edad}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sexo">Sexo *</Label>
                    <Select
                      value={formData.sexo}
                      onValueChange={(value) => setFormData({ ...formData, sexo: value })}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Femenino</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email_paciente">Email *</Label>
                    <Input
                      id="email_paciente"
                      name="email_paciente"
                      type="email"
                      value={formData.email_paciente}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Datos Clínicos */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Datos Clínicos</h3>
                <div className="space-y-2">
                  <Label htmlFor="diagnostico_principal">Diagnóstico Principal *</Label>
                  <Input
                    id="diagnostico_principal"
                    name="diagnostico_principal"
                    value={formData.diagnostico_principal}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sintomas">Síntomas</Label>
                  <Textarea
                    id="sintomas"
                    name="sintomas"
                    value={formData.sintomas}
                    onChange={handleChange}
                    disabled={loading}
                    rows={3}
                  />
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
                  />
                </div>
              </div>

              {/* Signos Vitales */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Signos Vitales</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="presion_arterial">Presión Arterial</Label>
                    <Input
                      id="presion_arterial"
                      name="presion_arterial"
                      placeholder="120/80"
                      value={formData.presion_arterial}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="frecuencia_cardiaca">Frecuencia Cardíaca (lpm)</Label>
                    <Input
                      id="frecuencia_cardiaca"
                      name="frecuencia_cardiaca"
                      type="number"
                      value={formData.frecuencia_cardiaca}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperatura">Temperatura (°C)</Label>
                    <Input
                      id="temperatura"
                      name="temperatura"
                      type="number"
                      step="0.1"
                      value={formData.temperatura}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="saturacion_oxigeno">Saturación de Oxígeno (%)</Label>
                    <Input
                      id="saturacion_oxigeno"
                      name="saturacion_oxigeno"
                      type="number"
                      value={formData.saturacion_oxigeno}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="frecuencia_respiratoria">Frecuencia Respiratoria (rpm)</Label>
                    <Input
                      id="frecuencia_respiratoria"
                      name="frecuencia_respiratoria"
                      type="number"
                      value={formData.frecuencia_respiratoria}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? 'Evaluando...' : 'Evaluar Ley de Urgencia'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
