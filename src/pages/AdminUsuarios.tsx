import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Edit, Trash2, User } from 'lucide-react';

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'medico' | 'medico_jefe';
  hospital?: string;
  especialidad?: string;
}

export default function AdminUsuarios() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'medico' as 'admin' | 'medico' | 'medico_jefe',
    hospital: '',
    especialidad: '',
  });

  useEffect(() => {
    if (userRole !== 'admin') {
      toast({
        title: 'Acceso denegado',
        description: 'No tiene permisos para acceder a esta sección',
        variant: 'destructive',
      });
      navigate('/dashboard');
      return;
    }
    loadUsuarios();
  }, [userRole]);

  const loadUsuarios = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('nombre');

    if (!error && data) {
      setUsuarios(data.map((u: any) => ({
        id: u.user_id,
        nombre: u.nombre,
        email: u.email,
        rol: u.role,
        hospital: u.hospital,
        especialidad: u.especialidad,
      })));
    }
    setLoading(false);
  };

  const handleOpenDialog = (user?: Usuario) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        nombre: user.nombre,
        email: user.email,
        password: '',
        rol: user.rol,
        hospital: user.hospital || '',
        especialidad: user.especialidad || '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        nombre: '',
        email: '',
        password: '',
        rol: 'medico',
        hospital: '',
        especialidad: '',
      });
    }
    setShowDialog(true);
  };

  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        // Editar usuario existente
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({
            nombre: formData.nombre,
            hospital: formData.hospital,
            especialidad: formData.especialidad,
            role: formData.rol,
          })
          .eq('user_id', editingUser.id);

        if (updateError) throw updateError;

        toast({
          title: 'Usuario actualizado',
          description: 'Los datos del usuario han sido actualizados exitosamente',
        });
      } else {
        // Crear nuevo usuario
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              nombre: formData.nombre,
            },
          },
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('No se pudo crear el usuario');

        // Crear role con todos los datos
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([
            {
              user_id: authData.user.id,
              role: formData.rol,
              nombre: formData.nombre,
              email: formData.email,
              hospital: formData.hospital,
              especialidad: formData.especialidad,
            },
          ]);

        if (roleError) throw roleError;

        toast({
          title: 'Usuario creado',
          description: 'El nuevo usuario ha sido creado exitosamente',
        });
      }

      setShowDialog(false);
      loadUsuarios();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este usuario?')) return;

    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;

      toast({
        title: 'Usuario eliminado',
        description: 'El usuario ha sido eliminado exitosamente',
      });

      loadUsuarios();
    } catch (error: any) {
      toast({
        title: 'Error al eliminar usuario',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getRoleBadge = (rol: string) => {
    switch (rol) {
      case 'admin':
        return <Badge variant="default">Administrador</Badge>;
      case 'medico_jefe':
        return <Badge variant="secondary">Médico Jefe</Badge>;
      default:
        return <Badge variant="outline">Médico</Badge>;
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
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
              <p className="text-sm text-white/80">Administrar médicos y médicos jefe</p>
            </div>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-white/20 hover:bg-white/30 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Usuario
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Cargando usuarios...</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {usuarios.map((usuario) => (
              <Card key={usuario.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="mb-2">{usuario.nombre}</CardTitle>
                        <CardDescription>{usuario.email}</CardDescription>
                        <div className="flex gap-2 mt-2">
                          {getRoleBadge(usuario.rol)}
                          {usuario.especialidad && (
                            <Badge variant="outline">{usuario.especialidad}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(usuario)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(usuario.id)}
                        className="text-destructive hover:bg-destructive hover:text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {usuario.hospital && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      <strong>Hospital:</strong> {usuario.hospital}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Dialog para crear/editar usuario */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Modifique los datos del usuario'
                : 'Complete los datos para crear un nuevo usuario'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre Completo *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!!editingUser}
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="rol">Rol *</Label>
              <Select
                value={formData.rol}
                onValueChange={(value: any) => setFormData({ ...formData, rol: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="medico">Médico</SelectItem>
                  <SelectItem value="medico_jefe">Médico Jefe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hospital">Hospital</Label>
              <Input
                id="hospital"
                value={formData.hospital}
                onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="especialidad">Especialidad</Label>
              <Input
                id="especialidad"
                value={formData.especialidad}
                onChange={(e) => setFormData({ ...formData, especialidad: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveUser}>
              {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
