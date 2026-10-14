const UserModel = require('../models/userModel');
const { generateToken } = require('../middlewares/authMiddleware');
const db = require('../config/database');

const cleanStr = (val) => (val ? String(val).trim().replace(/^["']|["']$/g, '') : '');
const ADMIN_USERNAME = cleanStr(process.env.ADMIN_USER) || 'PATTYps';
const ADMIN_PASSWORD = cleanStr(process.env.ADMIN_PASS) || 'PATTYpschincha452416';

const AuthController = {
  // Proceso de Login con verificación estricta de roles
  login(req, res) {
    try {
      let { username, password, mode } = req.body;

      username = (username || '').trim();
      password = (password || '').trim();
      const loginMode = (mode || '').trim().toLowerCase();

      // Comparación flexible de clave y usuario admin
      const isMatchAdminPass = password && (password === ADMIN_PASSWORD || password.toLowerCase() === ADMIN_PASSWORD.toLowerCase());
      const isTargetingAdmin = loginMode === 'admin' ||
                               username.toLowerCase() === ADMIN_USERNAME.toLowerCase() ||
                               username.toLowerCase() === 'admin';

      // 1. Si el usuario intenta identificarse como Administrador
      if (isTargetingAdmin) {
        if (!password) {
          return res.status(400).json({
            success: false,
            error: 'Debes ingresar la contraseña de Administrador.'
          });
        }
        if (!isMatchAdminPass) {
          return res.status(401).json({
            success: false,
            error: 'Contraseña de Administrador incorrecta. Por favor verifica la clave.'
          });
        }
      }

      let assignedRole = 'cliente';
      let finalUsername = username;

      // Si la clave coincide con la de Administrador (o ingresó con usuario y clave correctas)
      if (isMatchAdminPass) {
        assignedRole = 'admin';
        finalUsername = ADMIN_USERNAME;
      } else {
        assignedRole = 'cliente';
        if (!finalUsername) {
          finalUsername = `Cliente_${Math.floor(100 + Math.random() * 900)}`;
        }
      }

      // Obtener o registrar usuario en base de datos
      let user = UserModel.findByUsername(finalUsername);
      const roleRecord = UserModel.getRoleByName(assignedRole);
      const roleId = roleRecord ? roleRecord.id : (assignedRole === 'admin' ? 1 : 2);

      if (!user) {
        user = UserModel.create({
          username: finalUsername,
          password_hash: assignedRole === 'admin' ? ADMIN_PASSWORD : null,
          role_id: roleId
        });
      } else if (assignedRole === 'admin') {
        // Asegurar que en la base de datos tenga rol admin id 1
        db.run('UPDATE usuarios SET role_id = 1 WHERE id = ?', [user.id]);
        user.role_id = 1;
        user.role_name = 'admin';
      }

      const tokenPayload = {
        id: user.id,
        username: finalUsername,
        role: assignedRole
      };

      const token = generateToken(tokenPayload);

      return res.status(200).json({
        success: true,
        message: assignedRole === 'admin'
          ? 'Acceso concedido como Administrador.'
          : 'Sesión iniciada como Cliente.',
        role: assignedRole,
        user: {
          id: user.id,
          username: finalUsername,
          role: assignedRole
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

  // Obtener perfil actual a partir del token
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
