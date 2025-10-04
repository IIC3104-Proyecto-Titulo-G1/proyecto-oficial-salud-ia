-- Crear tipo enum para roles de aplicación
CREATE TYPE public.app_role AS ENUM ('admin', 'medico', 'medico_jefe');

-- Crear tipo enum para estados de caso
CREATE TYPE public.estado_caso AS ENUM ('pendiente', 'aceptado', 'rechazado', 'derivado');

-- Crear tipo enum para decisiones
CREATE TYPE public.decision_tipo AS ENUM ('aceptado', 'rechazado', 'deriva');

-- Crear tipo enum para sugerencia IA
CREATE TYPE public.sugerencia_tipo AS ENUM ('aceptar', 'rechazar', 'incierto');

-- Crear tipo enum para tipo de notificación
CREATE TYPE public.tipo_notificacion AS ENUM ('caso_derivado');

-- Crear tipo enum para resultado comunicación
CREATE TYPE public.resultado_comunicacion AS ENUM ('aceptado', 'rechazado');

-- Tabla user_roles (separada por seguridad)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  hospital VARCHAR(255),
  especialidad VARCHAR(255),
  telefono VARCHAR(20),
  imagen TEXT,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Función de seguridad para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Tabla casos
CREATE TABLE public.casos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estado estado_caso DEFAULT 'pendiente',
  -- Datos del paciente
  nombre_paciente VARCHAR(255) NOT NULL,
  edad_paciente INTEGER NOT NULL,
  sexo_paciente VARCHAR(20) NOT NULL,
  email_paciente VARCHAR(255) NOT NULL,
  -- Datos clínicos
  diagnostico_principal TEXT NOT NULL,
  sintomas TEXT,
  historia_clinica TEXT,
  descripcion_adicional TEXT,
  -- Signos vitales
  presion_arterial VARCHAR(20),
  frecuencia_cardiaca INTEGER,
  temperatura DECIMAL(4,2),
  saturacion_oxigeno INTEGER,
  frecuencia_respiratoria INTEGER,
  -- Referencias a médicos
  medico_tratante_id UUID REFERENCES auth.users(id) NOT NULL,
  medico_jefe_id UUID REFERENCES auth.users(id),
  -- Timestamps
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_analisis_ia TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.casos ENABLE ROW LEVEL SECURITY;

-- Tabla resolución de casos
CREATE TABLE public.resolucion_caso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id UUID REFERENCES public.casos(id) ON DELETE CASCADE NOT NULL,
  decision_medico decision_tipo,
  comentario_medico TEXT,
  decision_final resultado_comunicacion,
  comentario_final TEXT,
  fecha_decision_medico TIMESTAMP,
  fecha_decision_medico_jefe TIMESTAMP
);

ALTER TABLE public.resolucion_caso ENABLE ROW LEVEL SECURITY;

-- Tabla sugerencia IA
CREATE TABLE public.sugerencia_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id UUID REFERENCES public.casos(id) ON DELETE CASCADE NOT NULL,
  sugerencia sugerencia_tipo NOT NULL,
  confianza INTEGER CHECK (confianza >= 0 AND confianza <= 100),
  explicacion TEXT,
  fecha_procesamiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.sugerencia_ia ENABLE ROW LEVEL SECURITY;

-- Tabla notificaciones
CREATE TABLE public.notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  caso_id UUID REFERENCES public.casos(id) ON DELETE CASCADE,
  tipo tipo_notificacion,
  titulo VARCHAR(255),
  mensaje TEXT,
  leido BOOLEAN DEFAULT FALSE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_lectura TIMESTAMP
);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- Tabla comunicaciones paciente
CREATE TABLE public.comunicaciones_paciente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id UUID REFERENCES public.casos(id) ON DELETE CASCADE,
  resultado resultado_comunicacion NOT NULL,
  explicacion TEXT NOT NULL,
  enviada BOOLEAN DEFAULT FALSE,
  fecha_envio TIMESTAMP,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.comunicaciones_paciente ENABLE ROW LEVEL SECURITY;

-- RLS Policies para user_roles
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para casos
CREATE POLICY "Medicos can view their own cases"
  ON public.casos FOR SELECT
  TO authenticated
  USING (
    auth.uid() = medico_tratante_id OR
    public.has_role(auth.uid(), 'medico_jefe')
  );

CREATE POLICY "Medicos can create cases"
  ON public.casos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'medico') OR
    public.has_role(auth.uid(), 'medico_jefe')
  );

CREATE POLICY "Medicos can update their own cases"
  ON public.casos FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = medico_tratante_id OR
    public.has_role(auth.uid(), 'medico_jefe')
  );

-- RLS Policies para resolucion_caso
CREATE POLICY "Users can view case resolutions"
  ON public.resolucion_caso FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.casos
      WHERE casos.id = resolucion_caso.caso_id
        AND (casos.medico_tratante_id = auth.uid() OR public.has_role(auth.uid(), 'medico_jefe'))
    )
  );

CREATE POLICY "Users can insert case resolutions"
  ON public.resolucion_caso FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'medico') OR
    public.has_role(auth.uid(), 'medico_jefe')
  );

CREATE POLICY "Users can update case resolutions"
  ON public.resolucion_caso FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.casos
      WHERE casos.id = resolucion_caso.caso_id
        AND (casos.medico_tratante_id = auth.uid() OR public.has_role(auth.uid(), 'medico_jefe'))
    )
  );

-- RLS Policies para sugerencia_ia
CREATE POLICY "Users can view AI suggestions for their cases"
  ON public.sugerencia_ia FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.casos
      WHERE casos.id = sugerencia_ia.caso_id
        AND (casos.medico_tratante_id = auth.uid() OR public.has_role(auth.uid(), 'medico_jefe'))
    )
  );

CREATE POLICY "System can insert AI suggestions"
  ON public.sugerencia_ia FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies para notificaciones
CREATE POLICY "Users can view their own notifications"
  ON public.notificaciones FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY "System can create notifications"
  ON public.notificaciones FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
  ON public.notificaciones FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id);

-- RLS Policies para comunicaciones_paciente
CREATE POLICY "Users can view patient communications for their cases"
  ON public.comunicaciones_paciente FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.casos
      WHERE casos.id = comunicaciones_paciente.caso_id
        AND (casos.medico_tratante_id = auth.uid() OR public.has_role(auth.uid(), 'medico_jefe'))
    )
  );

CREATE POLICY "Users can insert patient communications"
  ON public.comunicaciones_paciente FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'medico') OR
    public.has_role(auth.uid(), 'medico_jefe')
  );

-- Crear usuario admin inicial
-- Primero necesitamos crear el usuario en auth.users, esto se hará manualmente
-- Pero dejamos preparado el trigger para cuando se cree

CREATE OR REPLACE FUNCTION public.handle_admin_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si el email es del admin, crear el role
  IF NEW.email = 'admin@saludia.cl' THEN
    INSERT INTO public.user_roles (user_id, role, nombre, email)
    VALUES (NEW.id, 'admin', 'Administrador', NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_user();