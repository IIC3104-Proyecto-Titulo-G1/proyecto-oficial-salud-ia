-- Agregar columna para comentario del email (separado de comentario_final)
ALTER TABLE resolucion_caso 
ADD COLUMN comentario_email text;