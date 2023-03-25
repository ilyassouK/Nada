const express = require('express');
const router = express.Router();
const {check} = require('express-validator');
const {verifyToken, managersToken, adminToken} = require('../controllers/Auth.controller');
const {nextDbProccess} = require('../controllers/Helper.controller');
const {addItem, warehouseItems, selectItems, deleteItems, addNewUnit, fetchAllUnits} = require('../controllers/Items.controller');
const {deliveryProducts, fetchTransactions, returnBackProducts, attendingProducts, fetchAttendedProducts, deleteTracked, covenant, agreement} = require('../controllers/Products.controller');
const {fetchUsers, AddUser, deleteUsers, fetchOneUser, updateOneUser} = require('../controllers/Users.controller');
const {selectEmployees} = require('../controllers/Employees.controller');
const {AddClient, fetchClients, selectClients, deleteClients, fetchOneClient, updateOneClient} = require('../controllers/Clients.controller');

// ==== Items =======================================================================
router.post('/v1/items/path0', managersToken, addItem); //إضافة صنف
router.get('/v1/items/path1', managersToken, warehouseItems, nextDbProccess); //أصناف المستودع
// Get Active Items (id, name) [من اجل تحديد الصنف عند نقل و الإسترجاع]
router.get('/v1/items/path2', managersToken, selectItems, nextDbProccess)
router.post('/v1/items/path3', adminToken, deleteItems); //حذف 
router.post('/v1/items/path4', [
    check('name').notEmpty().withMessage('الرجاء إدخال إسم الوحدة'),
], adminToken, addNewUnit); //إضافة وحدة 
router.get('/v1/items/path5', adminToken, fetchAllUnits, nextDbProccess); // جلب الوحدات
// ==================================================================================

// ===== Products ===================================================================
router.post('/v1/products/path0', managersToken, deliveryProducts)
router.get('/v1/products/path1/:id', verifyToken, fetchTransactions, nextDbProccess)
router.post('/v1/products/path2', managersToken, returnBackProducts)
router.post('/v1/products/path3', verifyToken, attendingProducts)
router.get('/v1/products/path4', verifyToken, fetchAttendedProducts, nextDbProccess);
// Delete tracking records
router.post('/v1/products/path5', verifyToken, deleteTracked);
router.get('/v1/products/path6/:id', verifyToken, covenant); //بيانات العهد
router.get('/v1/products/path7/:id', verifyToken, agreement); //بيانات العقد / الإتفاقية
// ==================================================================================

// ==== USERS =======================================================================
router.post('/v1/users/path0',[
    check('username').notEmpty().withMessage('الرجاء إدخال إسم المستخدم'),
    check('password').isLength({ min: 8 }).withMessage('كلمة المرور يجب أن لا تقل عن 8')
], managersToken, AddUser); // إضافة
router.get('/v1/users/path1', managersToken, fetchUsers, nextDbProccess); // المستخدمين
router.post('/v1/users/path2', adminToken, deleteUsers); // حذف 
router.get('/v1/users/path2/:id', managersToken, fetchOneUser) // fetchOne
router.post('/v1/users/path3/:id',[
    check('username').notEmpty().withMessage('الرجاء إدخال إسم المستخدم')
], verifyToken, updateOneUser) // updateOneClient

// ==================================================================================

// ==================================================================================
// Get Active Employees (id, fullName) [من اجل تحديد الموظف عند نقل و الإسترجاع]
router.get('/v1/employees/path2/', managersToken, selectEmployees, nextDbProccess)
// ==================================================================================

// ==== CLIENT ======================================================================
router.post('/v1/clients/path0', managersToken, AddClient); // إضافة
router.get('/v1/clients/path1', managersToken, fetchClients, nextDbProccess);// المحلات
// Get Active Employees (id, fullName) [من اجل تحديد الموظف عند نقل و الإسترجاع]
router.get('/v1/clients/path2', managersToken, selectClients, nextDbProccess);
router.post('/v1/clients/path3', adminToken, deleteClients); //حذف 
router.get('/v1/clients/path4/:id', managersToken, fetchOneClient) // fetchOne
router.post('/v1/clients/path5/:id', managersToken, updateOneClient) // updateOneClient
// ==================================================================================


module.exports = router