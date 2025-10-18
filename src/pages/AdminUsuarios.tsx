import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Edit, Trash2, User, LogOut, UserIcon, Search } from 'lucide-react';

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'medico' | 'medico_jefe';
  hospital?: string;
  especialidad?: string;
  imagen?: string;
}

type RolFiltro = 'todos' | 'admin' | 'medico' | 'medico_jefe';

export default function AdminUsuarios() {
  const { user, userRole, userRoleData, signOut, refreshUserRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rolFiltro, setRolFiltro] = useState<RolFiltro>('todos');
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
      navigate('/login');
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
        imagen: u.imagen,
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const response = await fetch(
        `https://kbveluprkmphtuxfvpha.supabase.co/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al eliminar usuario');
      }

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
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

  const filteredUsuarios = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    
    return usuarios.filter((usuario) => {
      const matchesSearch = normalizedSearch === '' || 
        usuario.nombre.toLowerCase().includes(normalizedSearch) ||
        usuario.email.toLowerCase().includes(normalizedSearch) ||
        (usuario.hospital && usuario.hospital.toLowerCase().includes(normalizedSearch)) ||
        (usuario.especialidad && usuario.especialidad.toLowerCase().includes(normalizedSearch));
      
      const matchesRol = rolFiltro === 'todos' || usuario.rol === rolFiltro;
      
      return matchesSearch && matchesRol;
    });
  }, [usuarios, searchTerm, rolFiltro]);

  const filtrosActivos = searchTerm.trim() !== '' || rolFiltro !== 'todos';

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-gradient-to-r from-primary to-secondary text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
              <p className="text-sm text-white/80">Administrar médicos y médicos jefe</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-white/20 hover:bg-white/30 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Usuario
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/perfil')}
                className="text-white hover:bg-white/20"
              >
                <UserIcon className="w-4 h-4 mr-2" />
                Mi Perfil
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-white hover:bg-white/20"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Salir
              </Button>
            </div>
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
          <div className="space-y-6">
            {/* Barra de búsqueda y filtros */}
            <Card>
              <CardHeader>
                <CardTitle>Buscar y Filtrar Usuarios</CardTitle>
                <CardDescription>
                  Busca usuarios por nombre, email, hospital o especialidad
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <div className="relative sm:max-w-sm w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Buscar por nombre, email, hospital o especialidad"
                        className="pl-10"
                      />
                    </div>
                    <Select value={rolFiltro} onValueChange={(value) => setRolFiltro(value as RolFiltro)}>
                      <SelectTrigger className="sm:w-56">
                        <SelectValue placeholder="Filtrar por rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los roles</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="medico">Médico</SelectItem>
                        <SelectItem value="medico_jefe">Médico Jefe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      Mostrando <span className="font-semibold text-foreground">{filteredUsuarios.length}</span> de {usuarios.length} usuarios
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchTerm('');
                        setRolFiltro('todos');
                      }}
                      disabled={!filtrosActivos}
                      className="disabled:opacity-50"
                    >
                      Limpiar filtros
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de usuarios */}
            {filteredUsuarios.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    {filtrosActivos 
                      ? 'No se encontraron usuarios que coincidan con los filtros aplicados'
                      : 'No hay usuarios registrados'
                    }
                  </p>
                  {filtrosActivos && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchTerm('');
                        setRolFiltro('todos');
                      }}
                      className="mt-4"
                    >
                      Limpiar filtros
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredUsuarios.map((usuario) => (
              <Card key={usuario.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={usuario.imagen || ''} alt={usuario.nombre} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {usuario.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
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
