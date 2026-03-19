import {
  attachPhoto,
  buildAviso,
  buildAvisoPreview,
  createInmueble,
  getByClave,
  listInmuebles,
  updateInmueble
} from "../services/inmuebleService.js";

export const list = async (req, res, next) => {
  try {
    const data = await listInmuebles({ query: req.query.q ?? "" });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getByClaveHandler = async (req, res, next) => {
  try {
    const inmueble = await getByClave(req.params.clave);
    if (!inmueble) {
      return res.status(404).json({ message: "Inmueble no encontrado." });
    }

    return res.json(inmueble);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    const inmueble = await createInmueble(req.body);
    res.status(201).json(inmueble);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const inmueble = await updateInmueble(req.params.id, req.body);
    res.json(inmueble);
  } catch (error) {
    next(error);
  }
};

export const uploadPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Debes seleccionar una fotografia." });
    }

    const inmueble = await attachPhoto(req.params.id, `/uploads/${req.file.filename}`);
    return res.json(inmueble);
  } catch (error) {
    next(error);
  }
};

export const getAviso = async (req, res, next) => {
  try {
    const aviso = await buildAviso(req.params.id);
    res.json(aviso);
  } catch (error) {
    next(error);
  }
};

export const previewAviso = async (req, res, next) => {
  try {
    const aviso = await buildAvisoPreview(req.body);
    res.json(aviso);
  } catch (error) {
    next(error);
  }
};
