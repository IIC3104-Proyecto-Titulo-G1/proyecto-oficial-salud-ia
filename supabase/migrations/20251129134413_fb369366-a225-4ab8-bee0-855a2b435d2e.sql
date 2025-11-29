-- Add prevision fields to casos table
ALTER TABLE casos 
ADD COLUMN prevision VARCHAR(50),
ADD COLUMN nombre_isapre VARCHAR(100),
ADD COLUMN estado_resolucion_aseguradora VARCHAR(20) DEFAULT 'pendiente';

-- Add comment to explain the fields
COMMENT ON COLUMN casos.prevision IS 'Tipo de previsión: Fonasa o Isapre';
COMMENT ON COLUMN casos.nombre_isapre IS 'Nombre de la Isapre cuando prevision es Isapre';
COMMENT ON COLUMN casos.estado_resolucion_aseguradora IS 'Estado de resolución: pendiente, aceptada, rechazada';