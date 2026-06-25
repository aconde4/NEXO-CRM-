# 07 · IA — proveedores y modelos (agnóstico)

> **Para qué sirve este documento.** La Fase 8 (IA) se construye **sin atarse a un
> proveedor**. Aquí está el diseño de la capa agnóstica y la **recomendación de modelos**,
> incluidas **opciones gratuitas**, para que se pueda **empezar gratis** y cambiar a Claude
> (u otro) solo editando `.env.local`. Acompaña a la Fase 8 de
> [`04-ROADMAP-DETALLADO.md`](04-ROADMAP-DETALLADO.md) y a la sección 9 de
> [`02-MODELO-DE-DATOS.md`](02-MODELO-DE-DATOS.md).

---

## 1. Idea clave: una interfaz, varios adaptadores

Casi todos los proveedores de LLM hablan **el mismo formato "OpenAI-compatible"**
(`POST /v1/chat/completions`). Eso permite cubrir **la mayoría** —incluidos los gratuitos
y los locales— con **un solo adaptador**. Solo Gemini y Anthropic/Claude necesitan
adaptador propio (y Gemini también ofrece un endpoint OpenAI-compatible).

```
AIProvider (interfaz interna del CRM)
  complete({ system, messages, schema?, maxTokens, temperature? })
      → { text, usage:{inTokens,outTokens}, raw }
  stream?(...)            // opcional

Adaptadores:
  ├─ openai-compatible    → OpenAI, Groq, OpenRouter, Together, DeepInfra,
  │                          Mistral, DeepSeek, Ollama / LM Studio (local)…
  ├─ gemini               → Google AI Studio (free tier)
  └─ anthropic            → Claude
```

El **`ai-service`** envuelve al proveedor activo: aplica timeouts/reintentos, parsea la
salida estructurada (JSON-schema cuando el caso lo pide) y **registra cada llamada en
`ai_runs`** (proveedor + modelo + tokens + coste estimado). Si no hay configuración, las
funciones de IA **se degradan con elegancia** (aparecen desactivadas, no rompen), igual
que Resend en la Fase 4.

### Configuración (solo en `.env.local`, nunca al repo)

```bash
AI_PROVIDER=openai-compatible      # openai-compatible | gemini | anthropic
AI_BASE_URL=...                    # según proveedor (ver abajo); no aplica a gemini/anthropic
AI_API_KEY=...                     # la clave del proveedor (vacío para Ollama local)
AI_MODEL=...                       # modelo de calidad por defecto
AI_MODEL_FAST=...                  # (opcional) modelo barato/rápido para volumen
```

**Cambiar de proveedor = cambiar estas variables.** Sin tocar código.

---

## 2. Opciones GRATIS (recomendadas para empezar)

> ⚠️ Los límites y la disponibilidad de los planes gratuitos **cambian** con frecuencia;
> verifícalos al registrarte. (Los precios de Claude del §3 sí están al día.)

| Opción | Cómo | Modelos típicos | Por qué / cuándo |
|---|---|---|---|
| **Google Gemini** (free tier) | API key en Google AI Studio | **Gemini 2.5 Flash**, 2.0 Flash | **Mejor calidad gratis** en general; multimodal; límites diarios generosos. Tiene endpoint OpenAI-compatible. **Recomendado para empezar.** |
| **Groq** (free tier) | API key; `AI_BASE_URL=https://api.groq.com/openai/v1` | **Llama 3.3 70B**, Llama 3.1 8B, Qwen | **Muy rápido**; OpenAI-compatible; ideal para resúmenes/scoring/sentimiento de alto volumen. |
| **OpenRouter** | API key; `AI_BASE_URL=https://openrouter.ai/api/v1` | modelos `:free` (varios Llama/Qwen/DeepSeek) | Un solo sitio para probar muchos modelos; límites variables. |
| **Ollama (local)** | Instalas Ollama; `AI_BASE_URL=http://localhost:11434/v1`, `AI_API_KEY=ollama` | **Qwen2.5** (7B/14B/32B), Llama 3.1/3.2, Mistral, Phi | **Coste 0, sin claves y privado**: los datos no salen de tu máquina. Encaja con el espíritu *self-hosted* del CRM. Calidad según tu hardware. |

**Ejemplos `.env.local`:**

```bash
# Gemini gratis (mejor calidad para empezar)
AI_PROVIDER=gemini
AI_API_KEY=tu_api_key_de_google_ai_studio
AI_MODEL=gemini-2.5-flash

# Groq gratis (rápido, OpenAI-compatible)
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=tu_api_key_de_groq
AI_MODEL=llama-3.3-70b-versatile
AI_MODEL_FAST=llama-3.1-8b-instant

# Ollama local (gratis, privado, sin claves)
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=qwen2.5:14b
AI_MODEL_FAST=qwen2.5:7b
```

---

## 3. Opciones de PAGO — Claude (Anthropic)

Precios al día (junio 2026), por millón de tokens (entrada / salida):

| Modelo | ID | Contexto | $/1M in | $/1M out | Para qué |
|---|---|---|---:|---:|---|
| Claude Haiku 4.5 | `claude-haiku-4-5` | 200K | $1 | $5 | **Barato y rápido**: scoring, sentimiento, resúmenes de volumen. |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | 1M | $3 | $15 | **Mejor equilibrio calidad/precio**: redacción de emails, NL→secuencia, next-best-action. **Recomendado de pago por defecto.** |
| Claude Opus 4.8 | `claude-opus-4-8` | 1M | $5 | $25 | Máxima capacidad Opus; para tareas difíciles puntuales. |
| Claude Fable 5 | `claude-fable-5` | 1M | $10 | $50 | El más capaz; sobredimensionado/caro para un CRM. |

```bash
# Claude de pago (cuando el usuario lo decida)
AI_PROVIDER=anthropic
AI_API_KEY=tu_ANTHROPIC_API_KEY
AI_MODEL=claude-sonnet-4-6       # calidad por defecto
AI_MODEL_FAST=claude-haiku-4-5   # volumen barato
```

> Otros de pago OpenAI-compatible (OpenAI GPT, Mistral, DeepSeek…) encajan en el adaptador
> `openai-compatible` cambiando `AI_BASE_URL`/`AI_MODEL`; no se priorizan aquí.

---

## 4. Recomendación por caso de uso (Fase 8)

| Tarea | Necesita | Gratis recomendado | De pago recomendado |
|---|---|---|---|
| 8.2 Redactar/responder email (tono) | Calidad de redacción | Gemini 2.5 Flash | Claude Sonnet 4.6 |
| 8.3 Resumen de historial | Rápido, barato | Groq Llama 3.3 70B / Gemini Flash | Claude Haiku 4.5 |
| 8.4 NL → secuencia/automatización | **Salida estructurada** + razonamiento | Gemini 2.5 Flash / Groq Llama 3.3 70B | Claude Sonnet 4.6 |
| 8.5 Lead scoring | Pequeño, estructurado, volumen | Groq Llama 3.1 8B / Ollama Qwen 7B | Claude Haiku 4.5 |
| 8.6 Siguiente mejor acción | Razonamiento | Gemini 2.5 Flash | Claude Sonnet 4.6 |
| 8.7 Sentimiento de respuestas | Diminuto, volumen | Ollama Qwen 7B / Groq Llama 8B | Claude Haiku 4.5 |

**Resumen de la recomendación**
- **Empezar (gratis):** **Gemini 2.5 Flash** (mejor calidad gratis) o **Groq + Llama 3.3
  70B** (rápido). Para **privacidad/coste cero total**: **Ollama + Qwen2.5** (los datos no
  salen de tu equipo — muy en línea con un CRM autoalojado).
- **Pasar a pago cuando convenga:** **Claude Sonnet 4.6** como modelo de calidad y
  **Claude Haiku 4.5** para tareas de volumen (scoring/sentimiento). Solo se cambia el
  `.env.local`.

---

## 5. Notas de implementación (para cuando se construya 8.1)

- **Salida estructurada:** definir el esquema con Zod y pedir JSON; validar la respuesta
  contra el esquema **y** contra los catálogos existentes (p. ej. en 8.4, validar la
  secuencia generada con `src/lib/validations` y `src/lib/automations`). No confiar en el
  texto del modelo sin validar.
- **`ai_runs`:** una fila por llamada (`provider`, `model`, `feature`, tokens, `cost`
  estimado a partir de una tabla de precios por modelo —0 para local/gratis—, `status`,
  `error`). Es la base del control de gasto y la depuración, **independiente del
  proveedor**.
- **Secretos:** todas las claves solo en `.env.local` (en `.gitignore`).
- **Degradación elegante:** sin `AI_PROVIDER`/claves válidas, la UI muestra la función de
  IA desactivada con un aviso; nada de errores. Igual patrón que Resend (4.x) y Storage
  (1.12).
- **Pendiente previo conocido:** las acciones de automatización `send_email` y `ai_summary`
  (Fase 6.5) se completan apoyándose en esta capa de IA (resumen) y en el transporte de
  email ya existente.
