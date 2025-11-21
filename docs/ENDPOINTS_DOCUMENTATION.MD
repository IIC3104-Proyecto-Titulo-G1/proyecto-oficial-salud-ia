# Documentación de Endpoints - urgencIA Backend

## Información General

**Base URL**: `http://localhost:3001/api`
**Documentación Swagger**: `http://localhost:3001/api/docs`

---

## 📊 Estructura de Datos de Entrada

### Datos Clínicos (`data` object)

Todos los endpoints de evaluación requieren un objeto `data` con los siguientes campos:

```json
{
  "data": {
    // IDENTIFICACIÓN
    "episodio": "string",                    // ID del episodio médico
    "centro": "string",                      // Centro hospitalario
    "fecha_ingreso": "ISO 8601 datetime",   // Fecha de ingreso (ej: "2024-11-21T10:30:00Z")

    // DIAGNÓSTICO
    "diagnostico": "string",                 // Diagnóstico principal

    // SIGNOS VITALES
    "pa_sistolica": "number",                // Presión arterial sistólica (mmHg)
    "pa_diastolica": "number",               // Presión arterial diastólica (mmHg)
    "pa_media": "number",                    // Presión arterial media (mmHg) - calculado automáticamente
    "fc": "number",                          // Frecuencia cardíaca (lpm)
    "fr": "number",                          // Frecuencia respiratoria (rpm)
    "temperatura_c": "number",               // Temperatura corporal (°C)
    "sat_o2": "number",                      // Saturación de oxígeno (%)
    "glasgow": "number",                     // Escala de Glasgow (3-15)

    // SOPORTE RESPIRATORIO
    "fio2": "number",                        // Fracción inspirada de oxígeno (%)
    "fio2_ge_50": "boolean",                 // FiO2 >= 50%
    "vm": "boolean",                         // Ventilación mecánica

    // ANTECEDENTES MÉDICOS
    "antecedentes_cardiacos": "boolean",     // Cardiopatía previa
    "antecedentes_diabeticos": "boolean",    // Diabetes mellitus
    "antecedentes_hta": "boolean",           // Hipertensión arterial

    // LABORATORIO
    "hb": "number",                          // Hemoglobina (g/dL)
    "creatinina": "number",                  // Creatinina (mg/dL)
    "bun": "number",                         // Nitrógeno ureico (mg/dL)
    "sodio": "number",                       // Sodio sérico (mEq/L)
    "potasio": "number",                     // Potasio sérico (mEq/L)
    "troponinas_alteradas": "boolean",       // Troponinas cardíacas alteradas

    // EVALUACIONES CLÍNICAS
    "triage": "string",                      // Nivel de triage
    "tipo_cama": "string",                   // Tipo de cama asignada
    "ecg_alterado": "boolean",               // ECG con alteraciones
    "dreo": "boolean",                       // Drogas vasoactivas
    "dva": "boolean",                        // Drogas vasoactivas específicas
    "compromiso_conciencia": "boolean",      // Alteración de conciencia
    "rnm_protocol_stroke": "boolean",        // Protocolo RNM stroke

    // PROCEDIMIENTOS
    "pcr": "boolean",                        // Parada cardiorrespiratoria
    "cirugia": "boolean",                    // Cirugía realizada
    "cirugia_same_day": "boolean",           // Cirugía el mismo día
    "hemodinamia": "boolean",                // Hemodinamia
    "hemodinamia_same_day": "boolean",       // Hemodinamia el mismo día
    "endoscopia": "boolean",                 // Endoscopia
    "endoscopia_same_day": "boolean",        // Endoscopia el mismo día
    "dialisis": "boolean",                   // Diálisis
    "trombolisis": "boolean",                // Trombólisis
    "trombolisis_same_day": "boolean",       // Trombólisis el mismo día
    "transfusiones": "number"                // Número de transfusiones
  },
  "patient_type": "adult|pediatric",         // Tipo de paciente (opcional, default: "adult")
  "provider": "grok|openai|gemini"          // Proveedor LLM (opcional para algunos endpoints)
}
```

---

## 🏥 Endpoints de Evaluación

### 1. Motor de Reglas

#### `POST /api/emergency/evaluate`
Evaluación determinística basada en DS N°34/2021

**Request:**
```json
{
  "data": { /* Datos clínicos completos */ },
  "patient_type": "adult"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "applies": true,
    "method": "rules",
    "evidence": ["Lista de criterios cumplidos"],
    "rule_details": {
      "triggered_rules": ["Reglas activadas"],
      "score": 85
    }
  }
}
```

### 2. Evaluación con LLM (Endpoint Unificado)

#### `POST /api/llm-emergency/evaluate`
Evaluación con IA usando el proveedor disponible (auto-selección o especificado)

**Request:**
```json
{
  "data": { /* Datos clínicos completos */ },
  "patient_type": "adult",
  "provider": "grok"  // Opcional: "grok", "openai", "gemini"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "applies": true,
    "method": "llm",
    "confidence": 0.95,
    "reasoning": "Razonamiento médico detallado del LLM",
    "evidence": ["Evidencias que sustentan la decisión"],
    "risk_factors": ["Factores de riesgo identificados"],
    "recommendations": ["Recomendaciones de manejo"],
    "llm_metadata": {
      "model": "grok-4-fast-reasoning",
      "provider": "xAI/Grok",
      "tokens_used": 2327
    },
    "provider_info": {
      "provider": "grok",
      "name": "Grok (xAI)",
      "model": "grok-4-fast-reasoning",
      "processing_time_ms": 8392
    }
  }
}
```

### 3. Multi-LLM - Proveedor Específico

#### `POST /api/multi-llm/evaluate`
Evaluación con un proveedor LLM específico

**Request:**
```json
{
  "data": { /* Datos clínicos completos */ },
  "provider": "openai",  // REQUERIDO: "grok", "openai", "gemini"
  "patient_type": "adult"
}
```

### 4. Endpoints Específicos por Proveedor

#### `POST /api/multi-llm/evaluate/grok`
#### `POST /api/multi-llm/evaluate/openai`
#### `POST /api/multi-llm/evaluate/gemini`

**Request:**
```json
{
  "data": { /* Datos clínicos completos */ },
  "patient_type": "adult"
}
```

### 5. Evaluación con Todos los LLMs

#### `POST /api/multi-llm/evaluate-all`
Evaluación paralela con todos los proveedores disponibles + motor de reglas

**Request:**
```json
{
  "data": { /* Datos clínicos completos */ },
  "patient_type": "adult"
}
```

**Response:**
```json
{
  "success": true,
  "evaluation": {
    "methods_evaluated": 4,
    "methods_failed": 0,
    "results": [
      {
        "provider": "rules",
        "result": { /* Resultado motor de reglas */ },
        "success": true
      },
      {
        "provider": "grok",
        "result": { /* Resultado Grok */ },
        "success": true
      },
      {
        "provider": "openai",
        "result": { /* Resultado OpenAI */ },
        "success": true
      },
      {
        "provider": "gemini",
        "result": { /* Resultado Gemini */ },
        "success": true
      }
    ],
    "concordance_analysis": {
      "total_methods": 4,
      "positive_votes": 3,
      "negative_votes": 1,
      "consensus": {
        "majority_positive": true,
        "agreement_rate": 0.75
      },
      "interpretation": "🟡 Mayoría sugiere APLICAR (3/4) con confianza LLM alta (87.3%)"
    }
  }
}
```

### 6. Comparación Metodologías

#### `POST /api/llm-emergency/compare`
Compara motor de reglas vs LLM específico

**Request:**
```json
{
  "data": { /* Datos clínicos completos */ },
  "patient_type": "adult",
  "provider": "gemini"  // Opcional
}
```

**Response:**
```json
{
  "success": true,
  "comparison": {
    "rules_method": {
      "applies": true,
      "method": "rules",
      "evidence": ["Criterios cumplidos"]
    },
    "llm_method": {
      "applies": true,
      "method": "llm",
      "confidence": 0.92,
      "reasoning": "...",
      "provider_info": { /* Info del proveedor */ }
    },
    "concordance": {
      "agreement": true,
      "rules_decision": true,
      "llm_decision": true,
      "interpretation": "Ambos métodos concuerdan: APLICA ley de urgencia"
    }
  }
}
```

---

## 🔍 Endpoints de Información

### 1. Estado de Salud

#### `GET /api/health`
Estado general del backend

#### `GET /api/llm-emergency/health`
Estado específico de servicios LLM

#### `GET /api/multi-llm/health`
Estado detallado de todos los proveedores LLM

### 2. Proveedores Disponibles

#### `GET /api/multi-llm/providers`

**Response:**
```json
{
  "success": true,
  "available_providers": [
    {
      "key": "grok",
      "name": "Grok (xAI)",
      "model": "grok-4-fast-reasoning",
      "enabled": true,
      "status": "configured"
    },
    {
      "key": "openai",
      "name": "OpenAI GPT-4o",
      "model": "gpt-4o-mini",
      "enabled": true,
      "status": "configured"
    },
    {
      "key": "gemini",
      "name": "Google Gemini Pro",
      "model": "gemini-2.5-flash",
      "enabled": true,
      "status": "configured"
    }
  ],
  "total_configured": 3
}
```

### 3. Métodos Disponibles

#### `GET /api/llm-emergency/methods`

**Response:**
```json
{
  "success": true,
  "available_methods": [
    {
      "name": "rules",
      "description": "Motor de reglas determinístico basado en DS N°34/2021",
      "features": ["Evaluación determinística", "Trazabilidad completa"],
      "suitable_for": "Casos estándar con criterios claros",
      "status": "available"
    },
    {
      "name": "llm",
      "description": "Evaluación con Inteligencia Artificial",
      "features": ["Razonamiento médico contextual", "Análisis integral"],
      "suitable_for": "Casos complejos o con múltiples factores",
      "status": "available"
    }
  ]
}
```

---

## 🧪 Casos de Prueba

### Caso Crítico (Debe aplicar Ley de Urgencia)

```bash
curl -X POST http://localhost:3001/api/multi-llm/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "episodio": "EP-CRITICO-001",
      "diagnostico": "Infarto agudo de miocardio con shock cardiogénico",
      "fecha_ingreso": "2024-11-21T10:30:00Z",
      "centro": "Hospital Regional",
      "pa_sistolica": 70,
      "pa_diastolica": 40,
      "fc": 130,
      "sat_o2": 85,
      "glasgow": 12,
      "troponinas_alteradas": true,
      "ecg_alterado": true,
      "vm": false,
      "dreo": true,
      "pcr": false
    },
    "provider": "grok",
    "patient_type": "adult"
  }'
```

### Caso Moderado (Evaluación ambigua)

```bash
curl -X POST http://localhost:3001/api/multi-llm/evaluate-all \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "episodio": "EP-MODERADO-001",
      "diagnostico": "Dolor torácico atípico",
      "fecha_ingreso": "2024-11-21T10:30:00Z",
      "centro": "Hospital Test",
      "pa_sistolica": 100,
      "pa_diastolica": 65,
      "fc": 95,
      "sat_o2": 96,
      "glasgow": 15,
      "troponinas_alteradas": false,
      "ecg_alterado": false
    },
    "patient_type": "adult"
  }'
```

### Caso Pediátrico

```bash
curl -X POST http://localhost:3001/api/llm-emergency/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "episodio": "EP-PEDS-001",
      "diagnostico": "Bronquiolitis severa",
      "fecha_ingreso": "2024-11-21T10:30:00Z",
      "centro": "Hospital Pediátrico",
      "fc": 160,
      "fr": 45,
      "sat_o2": 89,
      "temperatura_c": 38.5,
      "fio2": 60,
      "vm": true
    },
    "patient_type": "pediatric"
  }'
```

---

## ⚠️ Códigos de Error

- **400**: Datos faltantes o inválidos
- **500**: Error interno del servidor
- **503**: Proveedores LLM no disponibles

## 📝 Notas Importantes

1. **Fecha de Ingreso**: Debe estar en formato ISO 8601. La ventana de certificación es ≤6 horas.

2. **Campos Opcionales**: Todos los campos de `data` son opcionales, pero mayor información mejora la precisión.

3. **Proveedores LLM**:
   - **Grok**: `grok-4-fast-reasoning`
   - **OpenAI**: `gpt-4o-mini`
   - **Gemini**: `gemini-2.5-flash` (8192 tokens max)

4. **Variables de Entorno Requeridas**:
   ```bash
   GROK_API_KEY=xai-...
   OPENAI_API_KEY=sk-proj-...
   GEMINI_API_KEY=AIzaSy...
   ```

5. **Comando de Inicio**:
   ```bash
   GROK_API_KEY=xai-... GEMINI_API_KEY=AIzaSy... OPENAI_API_KEY=sk-proj-... npm start
   ```