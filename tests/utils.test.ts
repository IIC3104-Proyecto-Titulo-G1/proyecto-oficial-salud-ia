import { describe, it, expect } from 'vitest';
import { cn, getDoctorPrefix, consoleLogDebugger } from '@/lib/utils';

// Este es un unit test: verifica funciones utilitarias

describe('utils', () => {
  describe('cn', () => {
    it('combina clases correctamente (unit)', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    });

    it('maneja clases condicionales (unit)', () => {
      expect(cn('foo', true && 'bar', false && 'baz')).toBe('foo bar');
    });
  });

  describe('getDoctorPrefix', () => {
    it('retorna "Dr." para género masculino (unit)', () => {
      expect(getDoctorPrefix('masculino')).toBe('Dr.');
    });

    it('retorna "Dra." para género femenino (unit)', () => {
      expect(getDoctorPrefix('femenino')).toBe('Dra.');
    });

    it('retorna "Dr(a)." para género no especificado (unit)', () => {
      expect(getDoctorPrefix(null)).toBe('Dr(a).');
      expect(getDoctorPrefix(undefined)).toBe('Dr(a).');
      expect(getDoctorPrefix('')).toBe('Dr(a).');
    });
  });

  describe('consoleLogDebugger', () => {
    it('no lanza errores cuando se llama (unit)', () => {
      expect(() => consoleLogDebugger('test')).not.toThrow();
      expect(() => consoleLogDebugger('test', { data: 'value' })).not.toThrow();
    });
  });
});

