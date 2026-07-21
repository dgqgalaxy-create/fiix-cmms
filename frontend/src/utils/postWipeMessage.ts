/** sessionStorage key: message shown on Login after wipe/restore forces logout. */
export const POST_WIPE_MESSAGE_KEY = 'postWipeMessage';

export const WIPE_LOGOUT_MESSAGE = [
  'La base de datos fue vaciada correctamente.',
  'Tu sesión se cerró porque los usuarios ya no existen.',
  'Inicia sesión de nuevo con el administrador recreado: admin@fiix.com / password123.',
  'Te pedirá cambiar la contraseña al entrar.',
].join('\n');

export const RESTORE_LOGOUT_MESSAGE = [
  'El respaldo se restauró correctamente.',
  'Tu sesión se cerró porque los usuarios de la base pueden haber cambiado.',
  'Inicia sesión de nuevo con una cuenta válida del respaldo restaurado.',
].join('\n');
