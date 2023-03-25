const express = require('express');
const router = express.Router();
const {check} = require('express-validator');
const {verifyToken, reCheckAuth, login} = require('../controllers/Auth.controller');

// Path0: Re-check Auth
router.get('/v1/path0', verifyToken, reCheckAuth)

// Path1: Admin Login
router.post('/v1/path1',[
    check('username').notEmpty().withMessage('الرجاء إدخال إسم المستخدم'),
    check('password').isLength({ min: 8 }).withMessage('كلمة المرور يجب أن لا تقل عن 8')
], login)

module.exports = router;