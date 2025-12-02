import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDoctorPrefix(genero?: string | null): string {
  if (genero === 'masculino') return 'Dr.';
  if (genero === 'femenino') return 'Dra.';
  return 'Dr(a).';
}

// Flag para controlar si se muestran los console.logs
// Cambiar a true para activar los logs, false para desactivarlos (por defecto false para seguridad)
const ENABLE_CONSOLE_LOGS = false;

/**
 * Función segura para logging que solo muestra mensajes si ENABLE_CONSOLE_LOGS está en true.
 * Útil para evitar que información sensible quede en la consola del navegador.
 * 
 * @param {...any} args - Argumentos a imprimir (igual que console.log)
 * 
 * @example
 * consolelog2('Mensaje de debug'); // Solo se muestra si ENABLE_CONSOLE_LOGS = true
 * consolelog2('Usuario:', userData); // Solo se muestra si ENABLE_CONSOLE_LOGS = true
 */
export function consoleLogDebugger(...args: any[]): void {
  if (ENABLE_CONSOLE_LOGS) {
    console.log(...args);
  }
}
