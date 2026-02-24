import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getDocument,
  getDocumentValidation,
  listDocuments,
  updateDocument,
  updateDocumentValidation,
  deleteDocument,
  structureDocumentRoute,
} from '../controllers/documentController';

const router = Router();

router.use(authenticate);

router.get('/', listDocuments);
router.get('/:id', getDocumentValidation, getDocument);
router.patch('/:id', updateDocumentValidation, updateDocument);
router.delete('/:id', getDocumentValidation, deleteDocument);
router.post('/:id/structure', getDocumentValidation, structureDocumentRoute);

export default router;
