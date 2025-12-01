-- Cambiar el valor por defecto de estado_resolucion_aseguradora de 'pendiente' a 'pendiente_envio'
ALTER TABLE public.casos
ALTER COLUMN estado_resolucion_aseguradora SET DEFAULT 'pendiente_envio';

-- Actualizar el comentario de la columna para incluir el nuevo estado
COMMENT ON COLUMN casos.estado_resolucion_aseguradora IS 'Estado de resolución: pendiente, pendiente_envio, aceptada, rechazada';

