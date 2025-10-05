-- Asignar rol admin al usuario tallerintegraciong1@gmail.com
INSERT INTO user_roles (user_id, role, nombre, email)
SELECT 
  id,
  'admin'::app_role,
  'Administrador',
  email
FROM auth.users
WHERE email = 'tallerintegraciong1@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;