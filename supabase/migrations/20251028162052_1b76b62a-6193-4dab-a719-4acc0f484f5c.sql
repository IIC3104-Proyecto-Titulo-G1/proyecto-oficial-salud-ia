-- Agregar el tipo 'caso_resuelto' al enum tipo_notificacion
ALTER TYPE tipo_notificacion ADD VALUE IF NOT EXISTS 'caso_resuelto';