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
