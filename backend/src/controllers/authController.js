const UserModel = require('../models/userModel');
const { generateToken } = require('../middlewares/authMiddleware');
const db = require('../config/database');

const cleanStr = (val) => (val ? String(val).trim().replace(/^["']|["']$/g, '') : '');
const ADMIN_USERNAME = cleanStr(process.env.ADMIN_USER) || 'PATTYps';
const ADMIN_PASSWORD = cleanStr(process.env.ADMIN_PASS) || 'PATTYpschincha452416';

const AuthController = {
  // Proceso de Login con verificación flexible y segura de roles
  login(req, res) {
    try {
      let { username, password, mode } = req.body;

      username = (username || '').trim();
      password = (password || '').trim();
      const loginMode = (mode || '').trim().toLowerCase();

      // Acepta la clave del .env (PATTYpschincha452416), insensible a mayúsculas/minúsculas, o 'admin'
      const isMatchAdminPass = Boolean(
        password && (
          password === ADMIN_PASSWORD || 
          password.toLowerCase() === ADMIN_PASSWORD.toLowerCase() ||
          password === 'admin'
        )
      );

      // Si ingresó la contraseña maestra de admin: SIEMPRE ES ADMIN
      if (isMatchAdminPass) {
        const finalUsername = username || ADMIN_USERNAME;
        let user = UserModel.findByUsername(finalUsername);
        const roleRecord = UserModel.getRoleByName('admin');
        const roleId = roleRecord ? roleRecord.id : 1;

        if (!user) {
          user = UserModel.create({
            username: finalUsername,
            password_hash: ADMIN_PASSWORD,
            role_id: roleId
          });
        } else {
          db.run('UPDATE usuarios SET role_id = 1 WHERE id = ?', [user.id]);
          user.role_id = 1;
          user.role_name = 'admin';
        }

        const token = generateToken({
          id: user.id,
          username: user.username || finalUsername,
          role: 'admin'
        });

        return res.status(200).json({
          success: true,
          message: '👑 ¡Acceso concedido como Administrador!',
          role: 'admin',
          user: {
            id: user.id,
            username: user.username || finalUsername,
            role: 'admin'
          },
          token
        });
      }

      // Si intentó identificarse como Administrador o ingresó contraseña
      const isTargetingAdmin = loginMode === 'admin' ||
                               username.toLowerCase() === ADMIN_USERNAME.toLowerCase() ||
                               username.toLowerCase() === 'admin' ||
                               Boolean(password);

      if (isTargetingAdmin) {
        if (!password) {
          return res.status(400).json({
            success: false,
            error: 'Debes ingresar la contraseña de Administrador (Clave: PATTYpschincha452416 o admin).'
          });
        }
        return res.status(401).json({
          success: false,
          error: 'Contraseña de Administrador incorrecta. Clave autorizada: PATTYpschincha452416 (o admin).'
        });
      }

      // Ingreso en Modo Cliente / Visitante
      if (!username) {
        username = `Cliente_${Math.floor(100 + Math.random() * 900)}`;
      }

      if (username.toLowerCase() === ADMIN_USERNAME.toLowerCase() || username.toLowerCase() === 'admin') {
        return res.status(400).json({
          success: false,
          error: `El nombre "${username}" está reservado para el Administrador. Ingresa la contraseña de administrador para acceder.`
        });
      }

      let user = UserModel.findByUsername(username);
      const roleRecord = UserModel.getRoleByName('cliente');
      const roleId = roleRecord ? roleRecord.id : 2;

      if (!user) {
        user = UserModel.create({
          username,
          password_hash: null,
          role_id: roleId
        });
      }

      const token = generateToken({
        id: user.id,
        username: user.username || username,
        role: 'cliente'
      });

      return res.status(200).json({
        success: true,
        message: '👋 Sesión iniciada como Cliente.',
        role: 'cliente',
        user: {
          id: user.id,
          username: user.username || username,
          role: 'cliente'
        },
        token
      });
    } catch (error) {
      console.error('[AUTH ERROR login]', error);
      return res.status(500).json({
        success: false,
        error: 'Error interno al procesar el inicio de sesión.'
      });
    }
  },

  me(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'No autenticado.' });
      }
      return res.status(200).json({
        success: true,
        user: req.user
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Error al verificar sesión.' });
    }
  }
};

module.exports = AuthController;
