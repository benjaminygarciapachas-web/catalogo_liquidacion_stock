const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'catalogo.sqlite');
const initSqlPath = path.resolve(__dirname, 'init.sql');

// Instancia de base de datos SQL
const db = new DatabaseSync(dbPath);

// Habilitar claves foráneas y modo WAL con sincronización física garantizada en disco
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = FULL;');
db.exec('PRAGMA wal_autocheckpoint = 100;');

// Inicializar esquema si las tablas no existen
function initDatabase() {
  try {
    if (fs.existsSync(initSqlPath)) {
      const sql = fs.readFileSync(initSqlPath, 'utf-8');
      db.exec(sql);
      console.log('✅ [DATABASE] Tablas y esquema SQL inicializados correctamente.');
    }

    // 1. Auto-migración segura de columnas en caso de bases de datos preexistentes
    const columns = db.prepare('PRAGMA table_info(productos)').all().map(c => c.name);
    if (!columns.includes('code')) {
      db.exec('ALTER TABLE productos ADD COLUMN code VARCHAR(100);');
      console.log('✅ [DATABASE] Columna `code` agregada a productos.');
    }
    if (!columns.includes('images')) {
      db.exec('ALTER TABLE productos ADD COLUMN images TEXT;');
      console.log('✅ [DATABASE] Columna `images` agregada a productos.');
    }

    // 2. Roles
    db.exec(`
      INSERT OR IGNORE INTO roles (id, name, description) VALUES
      (1, 'admin', 'Administrador con control total del catálogo'),
      (2, 'cliente', 'Cliente visitante del catálogo');
    `);

    // 3. Usuario Administrador PATTYps
    const adminUser = process.env.ADMIN_USER || 'PATTYps';
    const adminPass = process.env.ADMIN_PASS || 'PATTYpschincha452416';
    const existingAdmin = db.prepare('SELECT id FROM usuarios WHERE username = ?').get(adminUser);
    if (!existingAdmin) {
      db.prepare('INSERT INTO usuarios (username, password_hash, role_id) VALUES (?, ?, ?)')
        .run(adminUser, adminPass, 1);
      console.log('👑 [DATABASE] Usuario Administrador PATTYps creado.');
    }

    // 4. Categoría principal: Calzado (única y principal)
    db.exec(`
      DELETE FROM categorias;
      INSERT OR IGNORE INTO categorias (id, name, slug, icon) VALUES
      (1, 'Calzado', 'calzado', 'shoe');
      UPDATE categorias SET name = 'Calzado', slug = 'calzado', icon = 'shoe' WHERE id = 1;
    `);

    // 5. Subcategorías exactas para CATALOGO CALZADO DAMA:
    const subcats = [
      // Marca
      { id: 1, categoria_id: 1, tipo_grupo: 'Marca', name: 'zapatillas de marca', slug: 'zapatillas-de-marca' },
      // Normal
      { id: 2, categoria_id: 1, tipo_grupo: 'Normal', name: 'sandalias', slug: 'sandalias' },
      { id: 3, categoria_id: 1, tipo_grupo: 'Normal', name: 'balerinas flats', slug: 'balerinas-flats' },
      { id: 4, categoria_id: 1, tipo_grupo: 'Normal', name: 'cuñas', slug: 'cunas' },
      { id: 5, categoria_id: 1, tipo_grupo: 'Normal', name: 'botas largas', slug: 'botas-largas' },
      { id: 6, categoria_id: 1, tipo_grupo: 'Normal', name: 'botines', slug: 'botines' },
      { id: 7, categoria_id: 1, tipo_grupo: 'Normal', name: 'taco 3 a 5', slug: 'taco-3-a-5' },
      { id: 8, categoria_id: 1, tipo_grupo: 'Normal', name: 'taco 7 a 9', slug: 'taco-7-a-9' },
      { id: 9, categoria_id: 1, tipo_grupo: 'Normal', name: 'taco 12 a mas', slug: 'taco-12-a-mas' },
      { id: 10, categoria_id: 1, tipo_grupo: 'Normal', name: 'zapatillas', slug: 'zapatillas' }
    ];

    // Limpiar subcategorías antiguas
    db.exec(`DELETE FROM subcategorias;`);

    const insertSubcat = db.prepare(`
      INSERT OR REPLACE INTO subcategorias (id, categoria_id, tipo_grupo, name, slug)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const sc of subcats) {
      insertSubcat.run(sc.id, sc.categoria_id, sc.tipo_grupo, sc.name, sc.slug);
    }
  } catch (error) {
    console.error('❌ [DATABASE] Error al inicializar esquema SQL:', error);
  }
}

initDatabase();

// Métodos auxiliares para consultas limpias y seguras
const dbHelper = {
  // Retorna todas las filas encontradas
  all(sql, params = []) {
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      // Convertir prototipos u objetos limpios
      return rows.map(r => ({ ...r }));
    } catch (err) {
      console.error(`[DB ERROR all] ${sql}`, err);
      throw err;
    }
  },

  // Retorna una única fila
  get(sql, params = []) {
    try {
      const stmt = db.prepare(sql);
      const row = stmt.get(...params);
      return row ? { ...row } : null;
    } catch (err) {
      console.error(`[DB ERROR get] ${sql}`, err);
      throw err;
    }
  },

  // Ejecuta INSERT, UPDATE o DELETE
  run(sql, params = []) {
    try {
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);
      return {
        changes: Number(result.changes),
        lastInsertRowid: Number(result.lastInsertRowid)
      };
    } catch (err) {
      console.error(`[DB ERROR run] ${sql}`, err);
      throw err;
    }
  },

  // Ejecuta sentencias directas
  exec(sql) {
    return db.exec(sql);
  },

  raw: db
};

module.exports = dbHelper;
