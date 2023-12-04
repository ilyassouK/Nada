const controllers = {}

const dataBase = require('../config/DB');
const { validationResult } = require('express-validator');
const jwtSecret = require('../config/jwtSecret');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt-nodejs');


// To check requests
controllers.verifyToken = (req, res, next) => {
    const token = req.header('Authorization');
    jwt.verify(token, jwtSecret.user, (error, data)=>{
        if(error || !data){
            return res.json({ success: false, msg: "غذراً, فأنت لا تملك الصلاحية لهذا الإجراء." })
        }
        tokenData = data;
        return next();
    })
}
// managersToken (Admin or StoreKeeper, not Employees)
controllers.managersToken = (req, res, next) => {
    const token = req.header('Authorization');
    jwt.verify(token, jwtSecret.user, (error, data)=>{
        if(error || !data || data.userType == "employee"){
            return res.json({ success: false, msg: "غذراً, فأنت لا تملك الصلاحية لهذا الإجراء." })
        }
        tokenData = data;
        return next();
    })
}
// adminToken (Admin Only)
controllers.adminToken = (req, res, next) => {
    const token = req.header('Authorization');
    jwt.verify(token, jwtSecret.user, (error, data)=>{
        if(error || !data || data.userType != "admin"){
            return res.json({ success: false, msg: "غذراً, فأنت لا تملك الصلاحية لهذا الإجراء." })
        }
        tokenData = data;
        return next();
    })
}
// Only admin can access and download data as Excel
controllers.excelMiddleware = (req, res, next) => {
    if(req.query.limtLess && tokenData.userType != "admin") {
        return res.json({success:false, msg:"You don't have the permission to download"})
    }
    return next()
}
// Path0: Re-check Auth
controllers.reCheckAuth = (req, res)=>{
    let id = tokenData.id;
    let username = tokenData.username;
    ///
    // let userType;
    let query = "SELECT id FROM users WHERE id = ? AND username = ?"
    dataBase.query(query, [id,username], (error, results) => {
        if (error || !results) return res.json({success:false,msg:'Error catched on re-check auth!'}) ;
        //If Exist:
        // Fetch data
        let query = `SELECT id,
                        username,
                        role,
                        full_name AS fullName,
                        first_name AS firstName,
                        parent_name AS parentName,
                        grand_father AS grandFather,
                        familly_name AS famillyName,
                        job_title AS jobTitle,
                        phone,
                        civil,
                        email,
                        active
                    FROM users WHERE id = ?`;
        dataBase.query(query,[id], (error, data)=>{
            if(error) return console.log('ERROR CATCHED ON RECHECKAUTH');
            if(data.length){
                delete data[0].password;
                data[0].userType = data[0].role == 1 ? "admin":data[0].role == 2 ? "storekeeper":"employee";
                // Generate Token
                let token = jwt.sign(JSON.stringify(data[0]), jwtSecret.user);
                return res.json({success:true, data:data, token:token})
            }
        })
    });

}

//Path1 Login
controllers.login = (req, res) => {
    /*
    step 1 : Check validator(username and password>8)
    step 2 : Check Username(account) is exists
            step 2.1: Compare password
                    step 2.1.A : Send token
    */
    
    // Handel Validator Erorrs
    const formError = validationResult(req);
    if (!formError.isEmpty()) {
        let setError = formError.errors[0].msg;
        return res.json({ success: false, msg: setError });
    }
    let username = req.body.username;
    let password = req.body.password;
    // step 2 : Check Account is exists
    let query = `SELECT * FROM users WHERE username = ?`;
    dataBase.query(query, [username],(error, data)=>{

        if(error) return res.json({success:false, msg:'حدث خطأ ما, الرجاء التحقق من الإتصال, و إعادة المحاولة.'})
        if(!data.length) return res.json({success:false, msg:'عذراً, لم تدخل إسم المستخدم بشكل صحيح.'})
        // step 2.1: Compare password
        bcrypt.compare(password, data[0].password, (err, isMatch) => {
            if(!isMatch){
                return res.json({success:false, msg:'كلمة المرور غير صحيحة, الرجاء المحاولة مجدداً'})
            }
            if(isMatch){
                //To include userType with token
                data[0].userType = data[0].role == 1 ? "admin":data[0].role == 2 ? "storekeeper":"employee";
                // Delete some sensitive data
                delete data[0].role;
                delete data[0].password;
                delete data[0].created_at;
                delete data[0].updated_at;
                // step 2.1.A Send token
                let token = jwt.sign(JSON.stringify(data[0]), jwtSecret.user);
                res.json({ success: true, token: token })
            }
        });
    })
}
module.exports=controllers;