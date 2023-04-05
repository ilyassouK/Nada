const express = require('express');
const router = express.Router();
const multer = require('multer')
const {check} = require('express-validator');
const {verifyToken, managersToken, adminToken, excelMiddleware} = require('../controllers/Auth.controller');
const {nextDbProccess} = require('../controllers/Helper.controller');
const {addItem, warehouseItems, selectItems, deleteItems, addNewUnit, fetchAllUnits, fetchOneItem, updateItem} = require('../controllers/Items.controller');
const {deliveryProducts, fetchTransactions, returnBackProducts, attendingProducts, fetchAttendedProducts, deleteTracked, covenant, agreement, allTransactionsReport} = require('../controllers/Products.controller');
const {fetchUsers, AddUser, deleteUsers, fetchOneUser, updateOneUser, addExcelUsers} = require('../controllers/Users.controller');
const {selectEmployees} = require('../controllers/Employees.controller');
const {AddClient, fetchClients, selectClients, deleteClients, fetchOneClient, updateOneClient, selectaddresses, addExcelClients} = require('../controllers/Clients.controller');


// Set up multer to handle file uploads
const upload = multer({ dest: 'uploads/' });

// ==== Items =======================================================================
router.post('/v1/items/path0', managersToken, addItem); //إضافة صنف
router.get('/v1/items/path1', managersToken, excelMiddleware,warehouseItems, nextDbProccess); //أصناف المستودع
// Get Active Items (id, name) [من اجل تحديد الصنف عند نقل و الإسترجاع]
router.get('/v1/items/path2', managersToken, selectItems, nextDbProccess)
router.post('/v1/items/path3', adminToken, deleteItems); //حذف 
router.post('/v1/items/path4', [
    check('name').notEmpty().withMessage('الرجاء إدخال إسم الوحدة'),
], managersToken, addNewUnit); //إضافة وحدة 
router.get('/v1/items/path5', managersToken, fetchAllUnits, nextDbProccess); // جلب الوحدات
router.get('/v1/items/path6/:id', managersToken, fetchOneItem); // Fetch one Item
router.post('/v1/items/path7/:id', managersToken, updateItem); //تحديث
// ==================================================================================

// ===== Products ===================================================================
router.post('/v1/products/path0', managersToken, deliveryProducts)
router.get('/v1/products/path1/:id', verifyToken, fetchTransactions, nextDbProccess)
router.post('/v1/products/path2', managersToken, returnBackProducts)
router.post('/v1/products/path3', verifyToken, attendingProducts)
router.get('/v1/products/path4', verifyToken, excelMiddleware, fetchAttendedProducts, nextDbProccess);
// Delete tracking records
router.post('/v1/products/path5', verifyToken, deleteTracked);
router.get('/v1/products/path6/:id', verifyToken, covenant); //بيانات العهد
router.get('/v1/products/path7/:id', verifyToken, agreement); //بيانات العقد / الإتفاقية
router.get('/v1/products/path8/:id', managersToken, allTransactionsReport, nextDbProccess); // تصدير الإنتقالات العُهد
// ==================================================================================

// ==== USERS =======================================================================
router.post('/v1/users/path0',[
    check('username').notEmpty().withMessage('الرجاء إدخال إسم المستخدم'),
    check('password').isLength({ min: 8 }).withMessage('كلمة المرور يجب أن لا تقل عن 8')
], adminToken, AddUser); // إضافة
router.get('/v1/users/path1', managersToken, excelMiddleware, fetchUsers, nextDbProccess); // المستخدمين
router.post('/v1/users/path2', adminToken, deleteUsers); // حذف 
router.get('/v1/users/path2/:id', managersToken, fetchOneUser) // fetchOne
router.post('/v1/users/path3/:id',[
    check('username').notEmpty().withMessage('الرجاء إدخال إسم المستخدم')
], verifyToken, updateOneUser) // updateOneClient
router.post('/v1/users/path4', adminToken, upload.single('file'),addExcelUsers); // Excel Users 

// ==================================================================================

// ==================================================================================
// Get Active Employees (id, fullName) [من اجل تحديد الموظف عند نقل و الإسترجاع]
router.get('/v1/employees/path2/', managersToken, selectEmployees, nextDbProccess)
// ==================================================================================

// ==== CLIENT ======================================================================
router.post('/v1/clients/path0', adminToken, AddClient); // إضافة
router.get('/v1/clients/path1', managersToken, excelMiddleware, fetchClients, nextDbProccess);// المحلات
// Get Active Employees (id, fullName) [من اجل تحديد الموظف عند نقل و الإسترجاع]
router.get('/v1/clients/path2', managersToken, selectClients, nextDbProccess);
router.post('/v1/clients/path3', adminToken, deleteClients); //حذف 
router.get('/v1/clients/path4/:id', managersToken, fetchOneClient) // fetchOne
router.post('/v1/clients/path5/:id', managersToken, updateOneClient) // updateOneClient
router.get('/v1/clients/path6', managersToken, selectaddresses, nextDbProccess); // used in AddClient.vue(on add), Observed.vue & ProductsDelivery.vue(filter)
router.post('/v1/clients/path7', adminToken, upload.single('file'), addExcelClients); // Excel Clients 

// ==================================================================================


module.exports = router