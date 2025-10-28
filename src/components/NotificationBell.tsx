import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  caso_id: string;
  leido: boolean;
  fecha_creacion: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const loadNotificaciones = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', user.id)
      .order('fecha_creacion', { ascending: false })
      .limit(10);

    if (!error && data) {
      setNotificaciones(data);
      setUnreadCount(data.filter(n => !n.leido).length);
    }
  };

  useEffect(() => {
    loadNotificaciones();

    // Suscribirse a cambios en notificaciones
    const channel = supabase
      .channel('notificaciones-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${user?.id}`
        },
        () => {
          loadNotificaciones();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleNotificationClick = async (notificacion: Notificacion) => {
    // Marcar como leída
    if (!notificacion.leido) {
      // Actualizar estado local inmediatamente
      setNotificaciones(prev => 
        prev.map(n => n.id === notificacion.id ? { ...n, leido: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      // Actualizar en la base de datos
      await supabase
        .from('notificaciones')
        .update({ 
          leido: true,
          fecha_lectura: new Date().toISOString()
        })
        .eq('id', notificacion.id);
    }

    setOpen(false);

    // Navegar al dashboard con filtro del caso
    if (notificacion.caso_id) {
      navigate(`/dashboard?caso=${notificacion.caso_id}`);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    await supabase
      .from('notificaciones')
      .update({ 
        leido: true,
        fecha_lectura: new Date().toISOString()
      })
      .eq('usuario_id', user.id)
      .eq('leido', false);

    loadNotificaciones();
  };

  const formatTime = (dateString: string) => {
    // Agregar 'Z' para forzar que sea interpretado como UTC
    const date = new Date(dateString + 'Z');
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMins < 60) {
      return `Hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
    } else if (diffHours < 24) {
      return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    } else if (diffDays < 30) {
      return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    } else if (diffMonths < 12) {
      return `Hace ${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'}`;
    } else {
      return date.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`relative ${open ? 'bg-accent' : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-semibold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notificaciones</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              Marcar todas como leídas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notificaciones.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No hay notificaciones
            </div>
          ) : (
            <div className="divide-y">
              {notificaciones.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left p-4 hover:bg-accent transition-colors ${
                    !notif.leido ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{notif.titulo}</p>
                        {!notif.leido && (
                          <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notif.mensaje}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(notif.fecha_creacion)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
