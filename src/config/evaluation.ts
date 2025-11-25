// Configuración de endpoints de evaluación
export const EVALUATION_CONFIG = {
  baseUrl: 'https://urgencia-backend-production.up.railway.app',
  endpoints: {
    rules: '/api/emergency/evaluate',
    grok: '/api/multi-llm/evaluate/grok',
    openai: '/api/multi-llm/evaluate/openai',
    gemini: '/api/multi-llm/evaluate/gemini',
    compare: '/api/llm-emergency/compare',
    evaluateAll: '/api/multi-llm/evaluate-all',
  },
  methods: {
    rules: {
      name: 'Motor de Reglas',
      description: 'Evaluación determinística basada en DS N°34/2021',
      emoji: '🔧',
      deterministic: true,
    },
    grok: {
      name: 'Grok (xAI)',
      description: 'Evaluación con IA usando grok-4-fast-reasoning',
      deterministic: false,
    },
    openai: {
      name: 'OpenAI GPT-4o',
      description: 'Evaluación con IA usando GPT-4o-mini',
      deterministic: false,
    },
    gemini: {
      name: 'Google Gemini Pro',
      description: 'Evaluación con IA usando Gemini Pro',
      deterministic: false,
    },
  },
} as const;

export type EvaluationMethod = keyof typeof EVALUATION_CONFIG.methods;
