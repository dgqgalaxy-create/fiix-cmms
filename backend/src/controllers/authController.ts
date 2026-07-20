import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import { generateToken } from '../utils/auth';

/** Contraseñas por defecto conocidas (seed / import CSV). */
const DEFAULT_PASSWORDS = ['password123', 'CMMS2026*'];

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ error: 'Esta cuenta ha sido dada de baja. Contacta a un administrador.' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    let mustChange = user.must_change_password;
    if (!mustChange && DEFAULT_PASSWORDS.includes(password)) {
      mustChange = true;
      await prisma.user.update({
        where: { id: user.id },
        data: { must_change_password: true },
      });
    }

    const token = generateToken(user.id, user.role);

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      mustChangePassword: mustChange,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferences: user.preferences,
        must_change_password: mustChange,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

/** Cambia la contraseña del usuario autenticado y limpia must_change_password. */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    if (DEFAULT_PASSWORDS.includes(newPassword)) {
      res.status(400).json({ error: 'Elige una contraseña distinta a las predeterminadas del sistema.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    // Si ya debe cambiar (seed/CSV), no exigimos la actual; si no, sí.
    if (!user.must_change_password) {
      if (!currentPassword) {
        res.status(400).json({ error: 'La contraseña actual es obligatoria.' });
        return;
      }
      const ok = await bcrypt.compare(currentPassword, user.password_hash);
      if (!ok) {
        res.status(401).json({ error: 'Contraseña actual incorrecta.' });
        return;
      }
    } else if (currentPassword) {
      const ok = await bcrypt.compare(currentPassword, user.password_hash);
      if (!ok) {
        res.status(401).json({ error: 'Contraseña actual incorrecta.' });
        return;
      }
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash, must_change_password: false },
    });

    res.json({ message: 'Contraseña actualizada correctamente.', mustChangePassword: false });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
};
