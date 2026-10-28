import express from 'express';
import { login, me, logout } from '../controllers/authController.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', me);
router.post('/logout', logout);

export default router;
