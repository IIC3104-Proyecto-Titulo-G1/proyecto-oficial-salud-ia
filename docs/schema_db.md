-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.casos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  estado USER-DEFINED DEFAULT 'pendiente'::estado_caso,
  nombre_paciente character varying NOT NULL,
  edad_paciente integer NOT NULL,
  sexo_paciente character varying NOT NULL,
  email_paciente character varying,
  diagnostico_principal text NOT NULL,
  sintomas text,
  historia_clinica text,
  descripcion_adicional text,
  presion_arterial character varying,
  frecuencia_cardiaca integer,
  temperatura numeric,
  saturacion_oxigeno integer,
  frecuencia_respiratoria integer,
  medico_tratante_id uuid NOT NULL,
  medico_jefe_id uuid,
  fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  fecha_analisis_ia timestamp without time zone,
  fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT casos_pkey PRIMARY KEY (id),
  CONSTRAINT casos_medico_tratante_id_fkey FOREIGN KEY (medico_tratante_id) REFERENCES auth.users(id),
  CONSTRAINT casos_medico_jefe_id_fkey FOREIGN KEY (medico_jefe_id) REFERENCES auth.users(id)
);
CREATE TABLE public.comunicaciones_paciente (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  caso_id uuid,
  resultado USER-DEFINED NOT NULL,
  explicacion text NOT NULL,
  enviada boolean DEFAULT false,
  fecha_envio timestamp without time zone,
  fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT comunicaciones_paciente_pkey PRIMARY KEY (id),
  CONSTRAINT comunicaciones_paciente_caso_id_fkey FOREIGN KEY (caso_id) REFERENCES public.casos(id)
);
CREATE TABLE public.notificaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id uuid,
  caso_id uuid,
  tipo USER-DEFINED,
  titulo character varying,
  mensaje text,
  leido boolean DEFAULT false,
  fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  fecha_lectura timestamp without time zone,
  CONSTRAINT notificaciones_pkey PRIMARY KEY (id),
  CONSTRAINT notificaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id),
  CONSTRAINT notificaciones_caso_id_fkey FOREIGN KEY (caso_id) REFERENCES public.casos(id)
);
CREATE TABLE public.resolucion_caso (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  caso_id uuid NOT NULL,
  decision_medico USER-DEFINED,
  comentario_medico text,
  decision_final USER-DEFINED,
  comentario_final text,
  fecha_decision_medico timestamp without time zone,
  fecha_decision_medico_jefe timestamp without time zone,
  comentario_email text,
  CONSTRAINT resolucion_caso_pkey PRIMARY KEY (id),
  CONSTRAINT resolucion_caso_caso_id_fkey FOREIGN KEY (caso_id) REFERENCES public.casos(id)
);
CREATE TABLE public.sugerencia_ia (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  caso_id uuid NOT NULL,
  sugerencia USER-DEFINED NOT NULL,
  confianza integer CHECK (confianza >= 0 AND confianza <= 100),
  explicacion text,
  fecha_procesamiento timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sugerencia_ia_pkey PRIMARY KEY (id),
  CONSTRAINT sugerencia_ia_caso_id_fkey FOREIGN KEY (caso_id) REFERENCES public.casos(id)
);
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  nombre character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  hospital character varying,
  especialidad character varying,
  telefono character varying,
  imagen text,
  fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso timestamp without time zone,
  fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  genero text DEFAULT 'masculino'::text CHECK (genero = ANY (ARRAY['masculino'::text, 'femenino'::text, 'prefiero_no_responder'::text])),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);