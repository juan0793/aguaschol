import {
  addNoteLink,
  createNote,
  deleteNote,
  duplicateNote,
  getNote,
  listCategories,
  listNotes,
  moveNote,
  restoreNote,
  updateNote
} from "../services/notesService.js";

// Los 409 llevan la version actual de la nota para que el cliente se reconcilie; el
// errorHandler comun solo devuelve el mensaje.
const handle = (action, status = 200) => async (req, res, next) => {
  try {
    res.status(status).json(await action(req));
  } catch (error) {
    if (error.body) {
      res.status(error.status || 400).json({ message: error.message, ...error.body });
      return;
    }
    next(error);
  }
};

export const list = handle((req) => listNotes(req.authUser, req.query));
export const categories = handle(async (req) => ({ items: await listCategories(req.authUser) }));
export const detail = handle((req) => getNote(req.authUser, req.params.id));
export const create = handle((req) => createNote(req.authUser, req.body), 201);
export const update = handle((req) => updateNote(req.authUser, req.params.id, req.body));
export const move = handle((req) => moveNote(req.authUser, req.params.id, req.body));
export const duplicate = handle((req) => duplicateNote(req.authUser, req.params.id), 201);
export const remove = handle((req) => deleteNote(req.authUser, req.params.id));
export const restore = handle((req) => restoreNote(req.authUser, req.params.id));
export const link = handle((req) => addNoteLink(req.authUser, req.params.id, req.body), 201);
