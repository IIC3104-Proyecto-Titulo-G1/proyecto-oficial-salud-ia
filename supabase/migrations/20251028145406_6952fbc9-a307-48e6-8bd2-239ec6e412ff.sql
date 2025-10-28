-- Crear política RLS para permitir eliminar sugerencias IA de los casos del usuario
CREATE POLICY "Case owners can delete AI suggestions"
ON sugerencia_ia
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM casos
    WHERE casos.id = sugerencia_ia.caso_id
      AND (casos.medico_tratante_id = auth.uid() OR casos.medico_jefe_id = auth.uid())
  )
);

-- Limpiar sugerencias duplicadas, dejando solo la más reciente por caso
DELETE FROM sugerencia_ia
WHERE id NOT IN (
  SELECT DISTINCT ON (caso_id) id
  FROM sugerencia_ia
  ORDER BY caso_id, fecha_procesamiento DESC
);