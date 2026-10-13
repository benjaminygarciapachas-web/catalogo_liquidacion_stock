const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Credenciales oficiales probadas y activas de Cloudinary (hvoicb7h)
const OFFICIAL_CLOUD_NAME = 'hvoicb7h';
const OFFICIAL_API_KEY = '296764566543229';
const OFFICIAL_API_SECRET = 'PjrI6SwHn6CAb5Dmsfh26m5wzlg';

const cleanStr = (val) => (val ? String(val).trim().replace(/^["']|["']$/g, '') : '');

const cloudName = cleanStr(process.env.CLOUDINARY_CLOUD_NAME) || OFFICIAL_CLOUD_NAME;
let apiKey = cleanStr(process.env.CLOUDINARY_API_KEY) || OFFICIAL_API_KEY;
let apiSecret = cleanStr(process.env.CLOUDINARY_API_SECRET) || OFFICIAL_API_SECRET;

// Si la cuenta es hvoicb7h, asegurar estrictamente que se usen la API Key y API Secret oficiales
// para evitar el error "Invalid Signature" debido a espacios o errores tipográficos en Render
if (cloudName === OFFICIAL_CLOUD_NAME) {
  if (apiKey !== OFFICIAL_API_KEY) {
    console.warn(`⚠️ [CLOUDINARY] Corrigiendo API_KEY para ${OFFICIAL_CLOUD_NAME}`);
    apiKey = OFFICIAL_API_KEY;
  }
  if (apiSecret !== OFFICIAL_API_SECRET) {
    console.warn(`⚠️ [CLOUDINARY] Corrigiendo API_SECRET para ${OFFICIAL_CLOUD_NAME} para evitar Invalid Signature.`);
    apiSecret = OFFICIAL_API_SECRET;
  }
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true
});

const CloudinaryService = {
  // Subir una foto a Cloudinary y devolver la URL permanente HTTPS
  async uploadPhoto(filePathOrBuffer, filename = '') {
    try {
      const uploadOptions = {
        folder: 'catalogo_liquidacion_stock/productos',
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
        overwrite: false
      };

      let result;
      if (typeof filePathOrBuffer === 'string') {
        result = await cloudinary.uploader.upload(filePathOrBuffer, uploadOptions);
        // Limpiar archivo temporal si existe en disco local
        if (fs.existsSync(filePathOrBuffer)) {
          try { fs.unlinkSync(filePathOrBuffer); } catch (e) {}
        }
      } else {
        const base64Data = 'data:image/jpeg;base64,' + filePathOrBuffer.toString('base64');
        result = await cloudinary.uploader.upload(base64Data, uploadOptions);
      }

      return result.secure_url;
    } catch (error) {
      console.error('[CLOUDINARY UPLOAD ERROR]', error);
      throw error;
    }
  },

  // Respaldo de la base de datos completa de productos en Cloudinary (Raw JSON)
  async backupDatabase(productsArray) {
    try {
      if (!Array.isArray(productsArray)) return false;
      const jsonStr = JSON.stringify(productsArray, null, 2);
      const base64 = 'data:application/json;base64,' + Buffer.from(jsonStr).toString('base64');

      const res = await cloudinary.uploader.upload(base64, {
        resource_type: 'raw',
        public_id: 'database_backups/catalogo_liquidacion_stock_products.json',
        overwrite: true,
        invalidate: true
      });

      console.log('☁️ [CLOUDINARY] Respaldo permanente sincronizado:', res.secure_url);
      return true;
    } catch (err) {
      console.error('⚠️ [CLOUDINARY BACKUP ERROR]', err.message);
      return false;
    }
  },

  // Restaurar respaldo desde Cloudinary al arrancar el servidor
  async restoreDatabaseBackup() {
    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'hvoicb7h';
      const backupUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/database_backups/catalogo_liquidacion_stock_products.json?t=${Date.now()}`;
      
      const res = await fetch(backupUrl);
      if (!res.ok) {
        if (res.status === 404) {
          console.log('ℹ️ [CLOUDINARY] No hay respaldo previo en Cloudinary (primera ejecución).');
          return null;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const products = await res.json();
      if (Array.isArray(products)) {
        console.log(`📦 [CLOUDINARY] Respaldo recuperado con éxito: ${products.length} productos.`);
        return products;
      }
      return null;
    } catch (err) {
      console.log('ℹ️ [CLOUDINARY RESTORE] Sin respaldo previo o primera ejecución:', err.message);
      return null;
    }
  }
};

module.exports = { cloudinary, CloudinaryService };
