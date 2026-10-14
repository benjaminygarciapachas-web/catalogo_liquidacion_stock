import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'src/config/catalogo.sqlite');
const uploadsDir = path.resolve(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Inicializar DB
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

// Ejecutar init.sql
const initSql = fs.readFileSync(path.resolve(__dirname, 'src/config/init.sql'), 'utf-8');
db.exec(initSql);

console.log('🔄 Ejecutando inicialización limpia de estructura...');

// 1. Roles
db.exec(`
  INSERT OR IGNORE INTO roles (id, name, description) VALUES
  (1, 'admin', 'Administrador con control total del catálogo y visualización de sesiones'),
  (2, 'cliente', 'Cliente visitante del catálogo');
`);

// 2. Usuario Administrador
// Credenciales estrictas: PATTYps / PATTYpschincha452416
const adminExisting = db.prepare('SELECT id FROM usuarios WHERE username = ?').get('PATTYps');
if (!adminExisting) {
  db.prepare(`
    INSERT INTO usuarios (username, password_hash, role_id)
    VALUES (?, ?, ?)
  `).run('PATTYps', 'PATTYpschincha452416', 1);
  console.log('👑 Usuario Administrador creado: PATTYps');
}

// 3. Categorías Principales solicitadas: Ropa, Calzado, Electrónicos, Variados, Edredones
db.exec(`
  DELETE FROM subcategorias;
  DELETE FROM categorias;

  INSERT INTO categorias (id, name, slug, icon) VALUES
  (1, 'Ropa', 'ropa', 'shirt'),
  (2, 'Calzado', 'calzado', 'shoe'),
  (3, 'Electrónicos', 'electronicos', 'tv'),
  (4, 'Variados', 'variados', 'box'),
  (5, 'Edredones', 'edredones', 'bed');
`);

// 4. Subcategorías:
// - Ropa: Dama, Caballeros, Niños
// - Calzado: Dama, Caballeros, Niños
// - Electrónicos, Variados y Edredones: SIN subcategorías
const subcats = [
  // Ropa
  { id: 1, categoria_id: 1, tipo_grupo: 'Dama', name: 'Dama', slug: 'ropa-dama' },
  { id: 2, categoria_id: 1, tipo_grupo: 'Caballeros', name: 'Caballeros', slug: 'ropa-caballeros' },
  { id: 3, categoria_id: 1, tipo_grupo: 'Niños', name: 'Niños', slug: 'ropa-ninos' },
  // Calzado
  { id: 4, categoria_id: 2, tipo_grupo: 'Dama', name: 'Dama', slug: 'calzado-dama' },
  { id: 5, categoria_id: 2, tipo_grupo: 'Caballeros', name: 'Caballeros', slug: 'calzado-caballeros' },
  { id: 6, categoria_id: 2, tipo_grupo: 'Niños', name: 'Niños', slug: 'calzado-ninos' }
];

const insertSubcat = db.prepare(`
  INSERT OR REPLACE INTO subcategorias (id, categoria_id, tipo_grupo, name, slug)
  VALUES (?, ?, ?, ?, ?)
`);
for (const sc of subcats) {
  insertSubcat.run(sc.id, sc.categoria_id, sc.tipo_grupo, sc.name, sc.slug);
}

console.log('✅ Categorías, subcategorías y roles inicializados sin fotos de muestra.');
console.log('📷 El catálogo está limpio y listo para que el Administrador suba sus propias fotos reales.');
