import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { Request, Response } from 'express';

// NOTE: This file is a template. Replace MarcaModel operations with your DB layer (Sequelize, TypeORM, Mongo, etc.)

const router = express.Router();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'marcas');

// ensure upload dir exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {});

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.random().toString(36).substring(2,8)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({ storage });

function getPublicUrlForFile(filename: string, req: Request) {
  if (!filename) return null;
  const base = process.env.PUBLIC_API_BASE_URL;
  if (base) return `${base.replace(/\/$/, '')}/uploads/marcas/${filename}`;
  const proto = (req.protocol || 'http');
  const host = req.get('host') || 'localhost';
  return `${proto}://${host}/uploads/marcas/${filename}`;
}

async function deleteFileIfExists(filename: string) {
  if (!filename) return;
  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    await fs.unlink(filePath);
  } catch (e) {
    // ignore
  }
}

function extractFilenameFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    // Support absolute or relative URLs
    const parts = url.split('/');
    return parts[parts.length - 1] || null;
  } catch (e) {
    return null;
  }
}

// Placeholder auth middlewares - replace with your real ones
function requireStaffRole(req: Request, res: Response, next: any) { return next(); }
function requireAdminRole(req: Request, res: Response, next: any) { return next(); }

// ---------- Routes ----------

// GET /api/marcas - list marcas with optional filters: appId, nombre, activa
router.get('/', async (req: Request, res: Response) => {
  try {
    const { appId, nombre, activa } = req.query;
    // TODO: replace with DB query
    // Example: const marcas = await MarcaModel.findAll({ where: { appId, nombre: { $like: `%${nombre}%` }, activa } });
    const marcas: any[] = []; // placeholder
    return res.json(marcas);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error listing marcas' });
  }
});

// GET /api/marcas/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    // TODO: replace with DB fetch
    const marca = null; // await MarcaModel.findByPk(id);
    if (!marca) return res.status(404).json({ error: 'Marca not found' });
    return res.json(marca);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error fetching marca' });
  }
});

// POST /api/marcas - create marca (multipart form, field: image)
router.post('/', requireStaffRole, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const descripcion = String(req.body.descripcion || '').trim();
    const activa = req.body.activa === 'false' || req.body.activa === '0' ? false : true;

    // TODO: validate required fields
    // TODO: create DB record and save image filename/url
    const created: any = {
      id: Date.now(),
      nombre,
      descripcion,
      activa,
      logo: null
    };

    if (req.file && req.file.filename) {
      created.logo = getPublicUrlForFile(req.file.filename, req);
    }

    // Replace with actual DB insert and return created object
    return res.status(201).json(created);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error creating marca' });
  }
});

// PUT /api/marcas/:id - update marca (replaces image if uploaded)
router.put('/:id', requireStaffRole, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    // TODO: fetch marca from DB
    const existing: any = null; // await MarcaModel.findByPk(id);
    if (!existing) return res.status(404).json({ error: 'Marca not found' });

    // Update fields
    const nombre = typeof req.body.nombre !== 'undefined' ? String(req.body.nombre).trim() : existing.nombre;
    const descripcion = typeof req.body.descripcion !== 'undefined' ? String(req.body.descripcion).trim() : existing.descripcion;
    const activa = typeof req.body.activa !== 'undefined' ? (req.body.activa === 'false' || req.body.activa === '0' ? false : true) : existing.activa;

    // If new file uploaded, remove previous file
    if (req.file && req.file.filename) {
      const oldFilename = extractFilenameFromUrl(existing.logo || existing.imagen || '');
      if (oldFilename) await deleteFileIfExists(oldFilename);
      existing.logo = getPublicUrlForFile(req.file.filename, req);
    }

    // TODO: persist changes in DB
    existing.nombre = nombre;
    existing.descripcion = descripcion;
    existing.activa = activa;

    return res.json(existing);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error updating marca' });
  }
});

// PATCH /api/marcas/:id/baja - mark baja/activar { baja: true|false }
router.patch('/:id/baja', requireStaffRole, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const baja = !!req.body.baja;
    // TODO: fetch and update in DB
    const existing: any = null; // await MarcaModel.findByPk(id);
    if (!existing) return res.status(404).json({ error: 'Marca not found' });
    existing.baja = baja;
    // await existing.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error updating baja flag' });
  }
});

// DELETE /api/marcas/:id - remove permanently and delete file - requireAdminRole
router.delete('/:id', requireAdminRole, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    // TODO: fetch marca and remove DB record
    const existing: any = null; // await MarcaModel.findByPk(id);
    if (!existing) return res.status(404).json({ error: 'Marca not found' });
    const oldFilename = extractFilenameFromUrl(existing.logo || existing.imagen || '');
    if (oldFilename) await deleteFileIfExists(oldFilename);
    // await existing.destroy();
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error deleting marca' });
  }
});

export default router;

// Registration tip (index.ts):
// import marcaRoutes from './routes/marca.routes';
// app.use('/api/marcas', marcaRoutes);
