import { Router, Response } from 'express';
import { Role } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/authMiddleware';
import { createRateLimiter } from '../middlewares/rateLimit';
import { chatWithAI, AIContext } from '../services/aiService';
import prisma from '../config/prisma';

const router = Router();

const MAX_MESSAGES = 15;
const MAX_MESSAGE_CHARS = 4000;
const MAX_CONTEXT_CHARS = 20000;

const aiChatLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message:
    'Hiciste demasiadas consultas al asistente. Espera unos minutos antes de volver a intentarlo.',
  keyFn: (req) => {
    const authReq = req as AuthRequest;
    return authReq.user?.userId || '';
  }
});

const FALLBACK_PERMISSIONS: Record<string, Record<string, boolean>> = {
  ADMINISTRADOR: {
    VIEW_ALL_WORK_ORDERS: true,
    MANAGE_INVENTORY: true
  },
  GESTIONADOR: {
    VIEW_ALL_WORK_ORDERS: true,
    MANAGE_INVENTORY: true
  },
  TECNICO: {
    VIEW_ALL_WORK_ORDERS: false,
    MANAGE_INVENTORY: false
  },
  OBSERVADOR: {
    VIEW_ALL_WORK_ORDERS: true,
    MANAGE_INVENTORY: false
  }
};

function isAIEnabled(): boolean {
  return String(process.env.AI_ENABLED ?? 'true').toLowerCase() !== 'false';
}

function hasAPIKey(): boolean {
  return Boolean(process.env.AI_API_KEY && process.env.AI_API_KEY.trim().length > 5);
}

function modelName(): string {
  return process.env.AI_MODEL || 'deepseek/deepseek-v4.1-flash';
}

function providerName(): string {
  const baseURL = (process.env.AI_BASE_URL || '').toLowerCase();
  if (baseURL.includes('opencode.ai')) return 'OpenCode';
  if (baseURL.includes('openrouter.ai')) return 'OpenRouter';
  return 'OpenAI compatible';
}

async function loadPermissions(role: string): Promise<Record<string, boolean>> {
  const fallback = FALLBACK_PERMISSIONS[role] || {};
  try {
    const rolePermissions = await prisma.rolePermission.findUnique({
      where: { role: role as Role },
      select: { permissions: true }
    });
    const stored = rolePermissions?.permissions;
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      return { ...fallback, ...(stored as Record<string, boolean>) };
    }
  } catch (error) {
    console.error('[GTZ AI] No se pudieron cargar los permisos del rol:', error);
  }
  return fallback;
}

// Estado del asistente (no expone la API Key).
router.get('/status', authenticate, async (_req: AuthRequest, res: Response) => {
  res.json({
    enabled: isAIEnabled(),
    hasKey: hasAPIKey(),
    model: modelName(),
    fallbackModel: process.env.AI_FALLBACK_MODEL?.trim() || null,
    provider: providerName()
  });
});

// Enviar mensaje al asistente.
router.post(
  '/chat',
  authenticate,
  aiChatLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!isAIEnabled()) {
      res.status(503).json({
        error: 'El asistente de IA está deshabilitado por el administrador.'
      });
      return;
    }

    if (!hasAPIKey()) {
      res.status(503).json({
        error:
          'El asistente de IA todavía no tiene una API Key configurada. Pide al administrador que configure AI_API_KEY.'
      });
      return;
    }

    try {
      const { messages } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Se requiere un arreglo de mensajes válido.' });
        return;
      }

      const validMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      for (const rawMessage of messages.slice(-MAX_MESSAGES)) {
        if (!rawMessage || typeof rawMessage !== 'object') continue;
        if (rawMessage.role !== 'user' && rawMessage.role !== 'assistant') continue;
        if (typeof rawMessage.content !== 'string') continue;

        const content = rawMessage.content.trim();
        if (!content) continue;
        if (content.length > MAX_MESSAGE_CHARS) {
          res.status(400).json({
            error: `Cada mensaje puede tener como máximo ${MAX_MESSAGE_CHARS} caracteres.`
          });
          return;
        }
        validMessages.push({ role: rawMessage.role, content });
      }

      if (!validMessages.length || !validMessages.some((m) => m.role === 'user')) {
        res.status(400).json({ error: 'No se encontraron mensajes de usuario válidos.' });
        return;
      }

      const contextChars = validMessages.reduce((sum, m) => sum + m.content.length, 0);
      if (contextChars > MAX_CONTEXT_CHARS) {
        res.status(400).json({
          error:
            'La conversación es demasiado larga. Inicia una conversación nueva o divide la consulta en partes.'
        });
        return;
      }

      const dbUser = req.user?.userId
        ? await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { name: true, role: true, is_active: true }
          })
        : null;

      if (!dbUser || !dbUser.is_active) {
        res.status(401).json({ error: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' });
        return;
      }

      const permissions = await loadPermissions(dbUser.role);
      const context: AIContext = {
        userId: req.user!.userId,
        name: dbUser.name,
        role: dbUser.role,
        permissions
      };

      const result = await chatWithAI(validMessages, context);

      res.json({
        success: true,
        reply: result.reply,
        toolsUsed: result.toolsUsed,
        model: result.model,
        provider: result.provider
      });
    } catch (error: any) {
      const providerStatus = Number(error?.response?.status || 0);
      const providerMessage =
        error?.response?.data?.error?.message || error?.response?.data?.message || '';
      console.error('[GTZ AI Error]', {
        status: providerStatus || undefined,
        message: providerMessage || error?.message || String(error)
      });

      if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
        res.status(504).json({
          error:
            'El asistente tardó demasiado en responder. Intenta de nuevo con una pregunta más concreta.'
        });
        return;
      }

      if (providerStatus === 429) {
        res.status(429).json({
          error:
            'El proveedor de IA está recibiendo demasiadas solicitudes. Espera un momento e inténtalo de nuevo.'
        });
        return;
      }

      if (providerStatus === 401 || providerStatus === 403) {
        res.status(503).json({
          error:
            'La API Key del asistente no es válida o no tiene acceso al modelo configurado. Revisa AI_API_KEY y AI_MODEL.'
        });
        return;
      }

      if (providerStatus === 402) {
        res.status(503).json({
          error:
            'El proveedor de IA no tiene saldo disponible para el modelo configurado. Revisa tu cuenta o cambia AI_MODEL.'
        });
        return;
      }

      if (String(error?.message || '').includes('API Key')) {
        res.status(503).json({
          error:
            'El asistente no tiene una API Key configurada en el servidor. Pide al administrador que configure AI_API_KEY.'
        });
        return;
      }

      res.status(502).json({
        error:
          'No se pudo conectar con el proveedor de IA. Intenta de nuevo en unos minutos.'
      });
    }
  }
);

export default router;
