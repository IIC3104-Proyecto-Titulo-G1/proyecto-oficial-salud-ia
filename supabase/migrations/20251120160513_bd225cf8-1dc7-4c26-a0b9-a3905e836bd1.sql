-- Agregar columna genero a la tabla user_roles
ALTER TABLE public.user_roles 
ADD COLUMN genero TEXT DEFAULT 'masculino' CHECK (genero IN ('masculino', 'femenino', 'prefiero_no_responder'));

-- Actualizar registros existentes con valor por defecto
UPDATE public.user_roles 
SET genero = 'masculino' 
WHERE genero IS NULL;