import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { consoleLogDebugger } from '@/lib/utils';
import { ArrowLeft, Plus, Edit, Trash2, User, LogOut, UserIcon, Search, Users, FileText, Calendar, Filter, X, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AdminCasosPanel } from '@/components/AdminCasosPanel';
import { ExportDoctorMetricsButton } from '@/components/ExportDoctorMetricsButton';

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'medico' | 'medico_jefe';
  hospital?: string;
  especialidad?: string;
  imagen?: string;
}

interface MetricasMedico {
  totalCasos: number;
  porcentajeAceptacionIA: number;
  totalDerivaciones: number;
  casosAceptadosAseguradora: number;
  casosRechazadosAseguradora: number;
  casosAceptadosPorMedico: number;
}

type TipoFiltroMetrica = 'totalCasos' | 'porcentajeAceptacionIA' | 'totalDerivaciones' | 'casosAceptadosAseguradora' | 'casosRechazadosAseguradora';
type OperadorFiltro = 'mayor_igual' | 'menor_igual';

type RolFiltro = 'todos' | 'doctores' | 'admin' | 'medico' | 'medico_jefe';
type RangoMetricas = 'todos' | '30' | '7' | '1' | 'custom';

export default function AdminUsuarios() {
  const { user, userRole, userRoleData, signOut, refreshUserRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rolFiltro, setRolFiltro] = useState<RolFiltro>('doctores');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [activeTab, setActiveTab] = useState<'usuarios' | 'casos'>('usuarios');
  const [metricasPorUsuario, setMetricasPorUsuario] = useState<Record<string, MetricasMedico>>({});
  const [cargandoMetricas, setCargandoMetricas] = useState(false);
  const [rangoMetricas, setRangoMetricas] = useState<RangoMetricas>('todos');
  const [fechaInicioMetricas, setFechaInicioMetricas] = useState('');
  const [fechaFinMetricas, setFechaFinMetricas] = useState('');
  const [filtrosMetricas, setFiltrosMetricas] = useState<Array<{
    id: string;
    tipo: TipoFiltroMetrica;
    operador: OperadorFiltro;
    valor: number;
  }>>([]);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'medico' as 'admin' | 'medico' | 'medico_jefe',
    hospital: '',
    especialidad: '',
    genero: 'masculino',
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

  // Leer parámetro tab de la URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'casos' || tabParam === 'usuarios') {
      setActiveTab(tabParam);
      // Limpiar solo el parámetro tab, pero preservar otros parámetros como 'medico'
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('tab');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadUsuarios = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('nombre');

    if (!error && data) {
      const usuariosData = data.map((u: any) => ({
        id: u.user_id,
        nombre: u.nombre,
        email: u.email,
        rol: u.role,
        hospital: u.hospital,
        especialidad: u.especialidad,
        imagen: u.imagen,
      }));
      
      // Ordenar: primero médicos jefe, luego médicos normales, luego otros
      const usuariosOrdenados = usuariosData.sort((a, b) => {
        if (a.rol === 'medico_jefe' && b.rol !== 'medico_jefe') return -1;
        if (a.rol !== 'medico_jefe' && b.rol === 'medico_jefe') return 1;
        if (a.rol === 'medico' && b.rol !== 'medico') return -1;
        if (a.rol !== 'medico' && b.rol === 'medico') return 1;
        return 0;
      });
      
      setUsuarios(usuariosOrdenados);
      setLoading(false);
      
      // Cargar métricas después de establecer los usuarios
      loadMetricasMedicos(usuariosOrdenados);
    } else {
      setLoading(false);
    }
  };

  const handleOpenDialog = (usuarioEditar?: Usuario) => {
    if (usuarioEditar) {
      // Si es el usuario actual, redirigir a perfil
      if (usuarioEditar.id === user?.id) {
        navigate('/admin/perfil');
      } else {
        // Navegar a la vista de edición de otro usuario, abriendo directamente en Estadísticas
        navigate(`/admin/usuario/${usuarioEditar.id}?tab=estadisticas`);
      }
    } else {
      // Crear nuevo usuario - mantener el modal
      setEditingUser(null);
      setFormData({
        nombre: '',
        email: '',
        password: '',
        rol: 'medico',
        hospital: '',
        especialidad: '',
        genero: 'masculino',
      });
      setShowDialog(true);
    }
  };

  const handleCardClick = (usuario: Usuario) => {
    // Navegar a la vista de detalle del usuario, abriendo directamente en Estadísticas
    if (usuario.id === user?.id) {
      navigate('/admin/perfil');
    } else {
      navigate(`/admin/usuario/${usuario.id}?tab=estadisticas`);
    }
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
              genero: formData.genero,
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

  // Resetear a la primera página cuando cambien los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, rolFiltro, filtrosMetricas]);

  // Recargar métricas cuando cambian las fechas o el rango
  useEffect(() => {
    if (usuarios.length > 0) {
      loadMetricasMedicos(usuarios);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangoMetricas, fechaInicioMetricas, fechaFinMetricas]);

  const handleRangoMetricasChange = (value: RangoMetricas) => {
    setRangoMetricas(value);
    if (value !== 'custom') {
      setFechaInicioMetricas('');
      setFechaFinMetricas('');
    }
  };

  const loadMetricasMedicos = async (usuariosData: Usuario[]) => {
    try {
      setCargandoMetricas(true);
      const medicos = usuariosData.filter(u => u.rol === 'medico' || u.rol === 'medico_jefe');
      consoleLogDebugger('📊 Cargando métricas para', medicos.length, 'médicos');
      const metricas: Record<string, MetricasMedico> = {};

    // Construir rango de fechas según el selector
    let inicio: Date | null = null;
    let fin: Date = new Date();
    fin.setHours(23, 59, 59, 999);

    const hoy = new Date();
    switch (rangoMetricas) {
      case '1': {
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 1);
        fechaInicio.setHours(0, 0, 0, 0);
        inicio = fechaInicio;
        break;
      }
      case '7': {
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 7);
        fechaInicio.setHours(0, 0, 0, 0);
        inicio = fechaInicio;
        break;
      }
      case '30': {
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 30);
        fechaInicio.setHours(0, 0, 0, 0);
        inicio = fechaInicio;
        break;
      }
      case 'custom':
        if (fechaInicioMetricas && fechaFinMetricas) {
          inicio = new Date(fechaInicioMetricas);
          inicio.setHours(0, 0, 0, 0);
          fin = new Date(fechaFinMetricas);
          fin.setHours(23, 59, 59, 999);
        }
        break;
      case 'todos':
      default:
        inicio = null;
        break;
    }

    for (const medico of medicos) {
      try {
        // Construir query según el rol
        let casosQuery = supabase
          .from('casos')
          .select('id, estado, fecha_creacion, fecha_actualizacion, estado_resolucion_aseguradora, medico_tratante_id, medico_jefe_id');
        
        if (medico.rol === 'medico_jefe') {
          casosQuery = casosQuery.eq('medico_jefe_id', medico.id);
        } else {
          casosQuery = casosQuery.eq('medico_tratante_id', medico.id);
        }

        if (inicio) {
          casosQuery = casosQuery.gte('fecha_creacion', inicio.toISOString());
          casosQuery = casosQuery.lte('fecha_creacion', fin.toISOString());
        }

        const { data: casos, error: casosError } = await casosQuery;
        if (casosError) continue;

        const casosIds = casos?.map(c => c.id) || [];

        // Cargar sugerencias y resoluciones
        const [sugerenciasResult, resolucionesResult] = await Promise.all([
          supabase
            .from('sugerencia_ia')
            .select('caso_id, sugerencia')
            .in('caso_id', casosIds.length > 0 ? casosIds : ['00000000-0000-0000-0000-000000000000'])
            .order('fecha_procesamiento', { ascending: false }),
          supabase
            .from('resolucion_caso')
            .select('caso_id, decision_medico, decision_final')
            .in('caso_id', casosIds.length > 0 ? casosIds : ['00000000-0000-0000-0000-000000000000'])
        ]);

        const sugerencias = sugerenciasResult.data || [];
        const resoluciones = resolucionesResult.data || [];

        const sugerenciasMap = new Map(sugerencias.map(s => [s.caso_id, s]));
        const resolucionesMap = new Map(resoluciones.map(r => [r.caso_id, r]));

        // Calcular métricas
        const totalCasos = casos?.length || 0;
        const casosAceptadosPorMedico = casos?.filter(c => c.estado === 'aceptado').length || 0;

        // Derivaciones
        let totalDerivaciones = 0;
        if (medico.rol === 'medico_jefe') {
          // Para médico jefe: casos derivados que resolvió
          // Casos que fueron derivados a él (medico_jefe_id = su ID) y que tienen resolución
          const casosDerivados = casos?.filter(c => c.medico_jefe_id === medico.id) || [];
          // De esos casos, contamos los que tienen una resolución (fueron resueltos)
          totalDerivaciones = casosDerivados.filter(c => {
            const resolucion = resolucionesMap.get(c.id);
            // Caso resuelto si tiene decision_final o decision_medico
            return resolucion && (resolucion.decision_final || resolucion.decision_medico);
          }).length;
        } else {
          // Para médico normal: casos que él derivó
          // Un caso fue derivado si tiene medico_jefe_id asignado (independientemente del estado actual)
          // porque el estado puede cambiar después de que el médico jefe lo resuelva
          totalDerivaciones = casos?.filter(c => 
            c.medico_tratante_id === medico.id && 
            c.medico_jefe_id !== null && 
            c.medico_jefe_id !== undefined
          ).length || 0;
        }

        // Porcentaje aceptación IA
        let casosConSugerenciaAceptar = 0;
        let casosAceptadosConSugerenciaAceptar = 0;

        casos?.forEach(caso => {
          const sugerencia = sugerenciasMap.get(caso.id);
          const resolucion = resolucionesMap.get(caso.id);
          
          if (sugerencia?.sugerencia === 'aceptar') {
            casosConSugerenciaAceptar++;
            if (resolucion?.decision_medico === 'aceptado' || caso.estado === 'aceptado') {
              casosAceptadosConSugerenciaAceptar++;
            }
          }
        });

        const porcentajeAceptacionIA = casosConSugerenciaAceptar > 0
          ? (casosAceptadosConSugerenciaAceptar / casosConSugerenciaAceptar) * 100
          : 0;

        // Casos aceptados/rechazados por aseguradora
        const casosAceptadosAseguradora = casos?.filter(c => 
          c.estado === 'aceptado' && (c as any).estado_resolucion_aseguradora === 'aceptada'
        ).length || 0;

        const casosRechazadosAseguradora = casos?.filter(c => 
          c.estado === 'aceptado' && (c as any).estado_resolucion_aseguradora === 'rechazada'
        ).length || 0;

        metricas[medico.id] = {
          totalCasos,
          porcentajeAceptacionIA: Math.round(porcentajeAceptacionIA * 10) / 10,
          totalDerivaciones,
          casosAceptadosAseguradora,
          casosRechazadosAseguradora,
          casosAceptadosPorMedico,
        };
        consoleLogDebugger(`📊 Métricas para ${medico.nombre}:`, metricas[medico.id]);
      } catch (error) {
        consoleLogDebugger('Error cargando métricas para', medico.nombre, error);
        // Continuar con el siguiente médico si hay error
        continue;
      }
    }

    setMetricasPorUsuario(metricas);
    setCargandoMetricas(false);
    consoleLogDebugger('📊 Métricas cargadas para médicos:', Object.keys(metricas).length, 'médicos', metricas);
    } catch (error) {
      consoleLogDebugger('Error general cargando métricas:', error);
      setCargandoMetricas(false);
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

  const filteredUsuarios = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    
    return usuarios.filter((usuario) => {
      const matchesSearch = normalizedSearch === '' || 
        usuario.nombre.toLowerCase().includes(normalizedSearch) ||
        usuario.email.toLowerCase().includes(normalizedSearch) ||
        (usuario.hospital && usuario.hospital.toLowerCase().includes(normalizedSearch)) ||
        (usuario.especialidad && usuario.especialidad.toLowerCase().includes(normalizedSearch));
      
      const matchesRol = 
        rolFiltro === 'todos' || 
        usuario.rol === rolFiltro ||
        (rolFiltro === 'doctores' && (usuario.rol === 'medico' || usuario.rol === 'medico_jefe'));
      
      // Filtros por métricas (todos deben cumplirse)
      let matchesMetricas = true;
      if (filtrosMetricas.length > 0) {
        const metricas = metricasPorUsuario[usuario.id];
        if (!metricas) {
          matchesMetricas = false;
        } else {
          matchesMetricas = filtrosMetricas.every(filtro => {
            const valorMetrica = metricas[filtro.tipo];
            if (filtro.operador === 'mayor_igual') {
              return valorMetrica >= filtro.valor;
            } else {
              return valorMetrica <= filtro.valor;
            }
          });
        }
      }
      
      return matchesSearch && matchesRol && matchesMetricas;
    });
  }, [usuarios, searchTerm, rolFiltro, filtrosMetricas, metricasPorUsuario]);

  // Calcular usuarios paginados
  const totalPages = Math.ceil(filteredUsuarios.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsuarios = filteredUsuarios.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    // Scroll suave hacia la lista de usuarios
    setTimeout(() => {
      const usuariosSection = document.getElementById('usuarios-section');
      if (usuariosSection) {
        usuariosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const filtrosActivos = searchTerm.trim() !== '' || rolFiltro !== 'doctores' || filtrosMetricas.length > 0 || rangoMetricas !== 'todos';

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-gradient-to-r from-primary to-secondary text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Panel de Administración</h1>
              <p className="text-sm text-white/80">Gestionar usuarios y casos</p>
            </div>
            <div className="flex gap-2">
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
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'usuarios' | 'casos')} className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="usuarios" className="gap-2">
                <Users className="w-4 h-4" />
                Usuarios
              </TabsTrigger>
              <TabsTrigger value="casos" className="gap-2">
                <FileText className="w-4 h-4" />
                Casos
              </TabsTrigger>
            </TabsList>
            
            {activeTab === 'usuarios' && (
              <div className="flex gap-2">
                <ExportDoctorMetricsButton
                  doctors={filteredUsuarios
                    .filter(u => u.rol === 'medico' || u.rol === 'medico_jefe')
                    .map(u => ({
                      id: u.id,
                      nombre: u.nombre,
                      email: u.email,
                      rol: u.rol as 'medico' | 'medico_jefe',
                      hospital: u.hospital,
                      especialidad: u.especialidad,
                    }))}
                  rangoMetricas={rangoMetricas}
                  fechaInicioMetricas={fechaInicioMetricas}
                  fechaFinMetricas={fechaFinMetricas}
                  usuarioExportador={userRoleData?.nombre || 'Administrador'}
                  filtrosAplicados={{
                    busqueda: searchTerm || undefined,
                    rolFiltro: rolFiltro,
                    filtrosMetricas: filtrosMetricas,
                  }}
                />
                <Button
                  onClick={() => handleOpenDialog()}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Usuario
                </Button>
              </div>
            )}
            
            {activeTab === 'casos' && (
              <div id="admin-casos-buttons-container" className="flex gap-2" />
            )}
          </div>

          <TabsContent value="usuarios" className="mt-0">
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
                {/* Filtros de fecha y métricas */}
                <div className="mt-4 pt-4 border-t space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Filtro de fecha */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Rango de Tiempo para Métricas</Label>
                      <div className="flex flex-col gap-2">
                        <Select value={rangoMetricas} onValueChange={handleRangoMetricasChange}>
                          <SelectTrigger className="w-full">
                            <Calendar className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Rango de tiempo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="30">Últimos 30 días</SelectItem>
                            <SelectItem value="7">Últimos 7 días</SelectItem>
                            <SelectItem value="1">Último día</SelectItem>
                            <SelectItem value="custom">Personalizado</SelectItem>
                          </SelectContent>
                        </Select>
                        {rangoMetricas === 'custom' && (
                          <div className="flex gap-2">
                            <Input
                              type="date"
                              value={fechaInicioMetricas}
                              onChange={(e) => {
                                setFechaInicioMetricas(e.target.value);
                                setRangoMetricas('custom');
                              }}
                              placeholder="Fecha inicio"
                              className="flex-1"
                            />
                            <Input
                              type="date"
                              value={fechaFinMetricas}
                              onChange={(e) => {
                                setFechaFinMetricas(e.target.value);
                                setRangoMetricas('custom');
                              }}
                              placeholder="Fecha fin"
                              className="flex-1"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Filtros avanzados por métrica */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Filtros Avanzados por Métrica</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFiltrosMetricas([...filtrosMetricas, {
                              id: Date.now().toString(),
                              tipo: 'totalCasos',
                              operador: 'mayor_igual',
                              valor: 0
                            }]);
                          }}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Agregar filtro
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {filtrosMetricas.map((filtro, index) => (
                          <div key={filtro.id} className="flex gap-2">
                            <Select 
                              value={filtro.tipo} 
                              onValueChange={(value) => {
                                const nuevosFiltros = [...filtrosMetricas];
                                nuevosFiltros[index].tipo = value as TipoFiltroMetrica;
                                setFiltrosMetricas(nuevosFiltros);
                              }}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="totalCasos">Total de Casos</SelectItem>
                                <SelectItem value="porcentajeAceptacionIA">% Aceptación IA</SelectItem>
                                <SelectItem value="totalDerivaciones">Derivaciones</SelectItem>
                                <SelectItem value="casosAceptadosAseguradora">Aceptados Aseguradora</SelectItem>
                                <SelectItem value="casosRechazadosAseguradora">Rechazados Aseguradora</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select 
                              value={filtro.operador} 
                              onValueChange={(value) => {
                                const nuevosFiltros = [...filtrosMetricas];
                                nuevosFiltros[index].operador = value as OperadorFiltro;
                                setFiltrosMetricas(nuevosFiltros);
                              }}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mayor_igual">≥</SelectItem>
                                <SelectItem value="menor_igual">≤</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              value={filtro.valor === 0 ? '' : filtro.valor}
                              onChange={(e) => {
                                const nuevosFiltros = [...filtrosMetricas];
                                const valorInput = e.target.value;
                                // Si está vacío, establecer 0
                                if (valorInput === '') {
                                  nuevosFiltros[index].valor = 0;
                                } else {
                                  // Convertir a número (esto elimina automáticamente ceros a la izquierda)
                                  const valor = Number(valorInput);
                                  // No permitir valores negativos
                                  if (valor < 0) {
                                    nuevosFiltros[index].valor = 0;
                                  } else if (filtro.tipo === 'porcentajeAceptacionIA') {
                                    // Para porcentajes, limitar a 100
                                    nuevosFiltros[index].valor = valor > 100 ? 100 : valor;
                                  } else {
                                    nuevosFiltros[index].valor = valor;
                                  }
                                }
                                setFiltrosMetricas(nuevosFiltros);
                              }}
                              placeholder={filtro.tipo === 'porcentajeAceptacionIA' ? '0-100%' : '0'}
                              min={0}
                              max={filtro.tipo === 'porcentajeAceptacionIA' ? 100 : undefined}
                              step={filtro.tipo === 'porcentajeAceptacionIA' ? 0.1 : 1}
                              className="w-24"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setFiltrosMetricas(filtrosMetricas.filter((_, i) => i !== index));
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {filtrosMetricas.length === 0 && (
                          <p className="text-xs text-muted-foreground">No hay filtros aplicados. Haz clic en "Agregar filtro" para comenzar.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Buscar por nombre, email, hospital o especialidad"
                        className="pl-10 w-full"
                      />
                    </div>
                    <Select value={rolFiltro} onValueChange={(value) => setRolFiltro(value as RolFiltro)}>
                      <SelectTrigger className="sm:w-56">
                        <SelectValue placeholder="Filtrar por rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los roles</SelectItem>
                        <SelectItem value="doctores">Todos los doctores</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="medico">Médico</SelectItem>
                        <SelectItem value="medico_jefe">Médico Jefe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      Mostrando <span className="font-semibold text-foreground">{filteredUsuarios.length}</span> de {usuarios.length} usuarios
                      {filteredUsuarios.length > 0 && (
                        <span className="text-muted-foreground">
                          {' '}(Página {currentPage} de {totalPages})
                        </span>
                      )}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchTerm('');
                        setRolFiltro('doctores');
                        setFechaInicioMetricas('');
                        setFechaFinMetricas('');
                        setFiltrosMetricas([]);
                        setCurrentPage(1);
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
            <div id="usuarios-section">
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
                        setRolFiltro('doctores');
                        setRangoMetricas('todos');
                        setFechaInicioMetricas('');
                        setFechaFinMetricas('');
                        setFiltrosMetricas([]);
                      }}
                      className="mt-4"
                    >
                      Limpiar filtros
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-4">
                  {paginatedUsuarios.map((usuario) => (
              <Card 
                key={usuario.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleCardClick(usuario)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-6">
                    {/* Datos del doctor */}
                    <div className="flex items-start gap-4 flex-1">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={usuario.imagen || ''} alt={usuario.nombre} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {usuario.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="mb-2">
                          {usuario.id === user?.id ? 'Tú' : usuario.nombre}
                        </CardTitle>
                        <CardDescription>{usuario.email}</CardDescription>
                        <div className="flex gap-2 mt-2">
                          {getRoleBadge(usuario.rol)}
                          {usuario.rol !== 'admin' && usuario.especialidad && (
                            <Badge variant="outline">{usuario.especialidad}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Métricas del médico - A la derecha */}
                    {(usuario.rol === 'medico' || usuario.rol === 'medico_jefe') && (
                      <div className="flex-shrink-0">
                        {metricasPorUsuario[usuario.id] ? (
                          <TooltipProvider>
                            <div className="grid grid-cols-5 gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="bg-muted/50 rounded-lg p-3 border cursor-help">
                                    <div className="text-xs text-muted-foreground mb-1">Total Casos</div>
                                    <div className="text-lg font-bold">{metricasPorUsuario[usuario.id].totalCasos}</div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-semibold mb-1">¿Cómo se calcula?</p>
                                  <p className="text-xs">
                                    {usuario.rol === 'medico_jefe' 
                                      ? 'Total de casos que fueron derivados a este médico jefe en el período seleccionado.'
                                      : 'Total de casos registrados por este médico en el período seleccionado.'}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="bg-muted/50 rounded-lg p-3 border cursor-help">
                                    <div className="text-xs text-muted-foreground mb-1">% Aceptación IA</div>
                                    <div className="text-lg font-bold text-green-600">{metricasPorUsuario[usuario.id].porcentajeAceptacionIA}%</div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-semibold mb-1">¿Cómo se calcula?</p>
                                  <p className="text-xs">
                                    Porcentaje de casos donde la IA recomendaba aceptar y el médico efectivamente aceptó el caso. 
                                    Se calcula: (Casos aceptados cuando IA recomendaba aceptar / Total de casos donde IA recomendaba aceptar) × 100
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="bg-muted/50 rounded-lg p-3 border cursor-help">
                                    <div className="text-xs text-muted-foreground mb-1">
                                      {usuario.rol === 'medico_jefe' ? 'Derivados Resueltos' : 'Derivaciones'}
                                    </div>
                                    <div className="text-lg font-bold text-amber-600">{metricasPorUsuario[usuario.id].totalDerivaciones}</div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-semibold mb-1">¿Cómo se calcula?</p>
                                  <p className="text-xs">
                                    {usuario.rol === 'medico_jefe' 
                                      ? 'Cantidad de casos derivados a este médico jefe que fueron resueltos (aceptados o rechazados) en el período seleccionado.'
                                      : 'Cantidad de casos que este médico derivó a un médico jefe en el período seleccionado.'}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="bg-muted/50 rounded-lg p-3 border cursor-help">
                                    <div className="text-xs text-muted-foreground mb-1">Aceptados Aseg.</div>
                                    <div className="text-lg font-bold text-green-700">{metricasPorUsuario[usuario.id].casosAceptadosAseguradora}</div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-semibold mb-1">¿Cómo se calcula?</p>
                                  <p className="text-xs">
                                    Cantidad de casos aceptados por el médico que fueron aceptados por la aseguradora (Fonasa/Isapre) 
                                    en el período seleccionado.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="bg-muted/50 rounded-lg p-3 border cursor-help">
                                    <div className="text-xs text-muted-foreground mb-1">Rechazados Aseg.</div>
                                    <div className="text-lg font-bold text-red-700">{metricasPorUsuario[usuario.id].casosRechazadosAseguradora}</div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-semibold mb-1">¿Cómo se calcula?</p>
                                  <p className="text-xs">
                                    Cantidad de casos aceptados por el médico que fueron rechazados por la aseguradora (Fonasa/Isapre) 
                                    en el período seleccionado.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        ) : cargandoMetricas ? (
                          <div className="text-xs text-muted-foreground">Cargando métricas...</div>
                        ) : null}
                      </div>
                    )}
                    
                    {/* Botones de acción */}
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {(() => {
                        const pages: (number | string)[] = [];
                        
                        // Si hay 7 o menos páginas, mostrar todas
                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          // Siempre mostrar la primera página
                          pages.push(1);
                          
                          // Si la página actual está lejos del inicio
                          if (currentPage > 3) {
                            pages.push('...');
                          }
                          
                          // Calcular el rango de páginas a mostrar
                          let startPage = Math.max(2, currentPage - 1);
                          let endPage = Math.min(totalPages - 1, currentPage + 1);
                          
                          // Ajustar el rango si estamos cerca de los bordes
                          if (currentPage <= 3) {
                            endPage = 4;
                          }
                          if (currentPage >= totalPages - 2) {
                            startPage = totalPages - 3;
                          }
                          
                          // Agregar páginas del rango (sin duplicados)
                          for (let i = startPage; i <= endPage; i++) {
                            if (i !== 1 && i !== totalPages) {
                              pages.push(i);
                            }
                          }
                          
                          // Si la página actual está lejos del final
                          if (currentPage < totalPages - 2) {
                            pages.push('...');
                          }
                          
                          // Siempre mostrar la última página
                          pages.push(totalPages);
                        }
                        
                        return pages.map((page, index) => {
                          if (page === '...') {
                            return (
                              <span key={`ellipsis-${index}`} className="text-muted-foreground px-2">
                                ...
                              </span>
                            );
                          }
                          
                          const pageNum = page as number;
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => goToPage(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        });
                      })()}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </>
            )}
            </div>
          </div>
        )}
          </TabsContent>

          <TabsContent value="casos" className="mt-0">
            <AdminCasosPanel />
          </TabsContent>
        </Tabs>
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
            <div className="space-y-2">
              <Label htmlFor="genero">Género *</Label>
              <Select
                value={formData.genero}
                onValueChange={(value) => setFormData({ ...formData, genero: value })}
              >
                <SelectTrigger id="genero">
                  <SelectValue placeholder="Selecciona el género" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="femenino">Femenino</SelectItem>
                  <SelectItem value="prefiero_no_responder">Prefiero no responder</SelectItem>
                </SelectContent>
              </Select>
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
