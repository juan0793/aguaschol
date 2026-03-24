import {
  attachPhoto,
  archiveInmueble,
  buildAviso,
  buildAvisoPreview,
  createInmueble,
  deleteArchivedInmueble,
  getByClave,
  listInmuebles,
  restoreInmueble,
  updateInmueble
} from "../services/inmuebleService.js";

export const list = async (req, res, next) => {
  try {
    const archived = String(req.query.archived ?? "false").toLowerCase() === "true";
    if (archived && req.authUser?.role !== "admin") {
      return res.status(403).json({ message: "Solo administradores pueden ver fichas archivadas." });
    }

    const data = await listInmuebles({
      query: req.query.q ?? "",
      archived
    });
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
    const inmueble = await createInmueble(req.body, { actorUserId: req.authUser?.id });
    res.status(201).json(inmueble);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const inmueble = await updateInmueble(req.params.id, req.body, { actorUserId: req.authUser?.id });
    res.json(inmueble);
  } catch (error) {
    next(error);
  }
};

export const archive = async (req, res, next) => {
  try {
    const inmueble = await archiveInmueble(req.params.id, req.body, { actorUserId: req.authUser?.id });
    res.json(inmueble);
  } catch (error) {
    next(error);
  }
};

export const restore = async (req, res, next) => {
  try {
    const inmueble = await restoreInmueble(req.params.id, { actorUserId: req.authUser?.id });
    res.json(inmueble);
  } catch (error) {
    next(error);
  }
};

export const deleteArchived = async (req, res, next) => {
  try {
    const inmueble = await deleteArchivedInmueble(req.params.id, { actorUserId: req.authUser?.id });
    res.json({
      ok: true,
      inmueble
    });
  } catch (error) {
    next(error);
  }
};

export const uploadPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Debes seleccionar una fotografia." });
    }

    const inmueble = await attachPhoto(req.params.id, `/uploads/${req.file.filename}`, {
      actorUserId: req.authUser?.id
    });
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
