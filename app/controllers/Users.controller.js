const { validationResult } = require('express-validator');
const bcrypt = require("bcrypt-nodejs");
const controllers = {}
const dataBase = require('../config/DB');
const limit = 30;


controllers.AddUser = (req, res)=>{
    // Handel Validator Erorrs
    const formError = validationResult(req);
    if (!formError.isEmpty()) {
        let setError = formError.errors[0].msg;
        return res.json({ success: false, msg: setError });
    }
    /*
        Step1 : Check username doesn't exists before
            Step2: Hash Password
                Step3: Insert
    
    */
    let username = req.body.username;
    let password = req.body.password;

    let firstName = req.body.firstName;
    let parentName = req.body.parentName;
    let grandFather = req.body.grandFather;
    let famillyName = req.body.famillyName;
    let fullName = firstName +" "+ parentName + " " + grandFather + " " + famillyName;

    let payload = {
        role:req.body.role,
        username:username,
        full_name:fullName,
        first_name:firstName,
        parent_name:parentName,
        grand_father:grandFather,
        familly_name:famillyName,
        job_title:req.body.jobTitle || username,
        civil:req.body.civil,
        phone:req.body.phone,
    }

    // Step1 : Check username doesn't exists before
    let query = "SELECT id FROM users WHERE username = ?";
    dataBase.query(query,[username],(error, results)=>{
        console.log("🚀 ~ file: Users.controller.js:47 ~ dataBase.query ~ error:", error)
        if(error) return res.json({success:false, msg:"حدث خطأ اثناء إضافة المستخدم, الرجاء المحاولة مجدداً."})
        // Exist
        if(results.length){
            res.json({success:false, msg:"لقد تمت إضافة مستخدم بنفس الإسم من قبل."})
        }else{
            //Step2: Hash Password
            bcrypt.genSalt(10, (err,salt)=>{
                if(err) return console.log('ERROR CATCHED ON BYCRYPT');
                bcrypt.hash(password, salt, null, (err, hash)=>{
                    if(err) return console.log('ERROR CATCHED ON BYCRYPT');
                    if(hash){
                        payload.password = hash;
                        //Step3: Insert
                        query = `INSERT INTO users SET ?`;
                        dataBase.query(query, [payload], (error, data)=>{
                            console.log("🚀 ~ file: Users.controller.js:55 ~ dataBase.query ~ error:", error)
                            if(error) return res.json({success:false, msg:"عذراً. حدث خطأ عند إضافة المستخدم, الرجاء المحاولة مجدداً."});
                            if(!data.affectedRows) return res.json({success:false, msg:"عذراً. فشل إضافة المستخدم, الرجاء المحاولة مجدداً."});
                            
                            let roleName = payload.role == 1 ? "مدير النظام":payload.role == 2 ? "امين المستودع":"الموظف"
                            return res.json({success:true, msg:`رائع, تم إضافة ${roleName} الجديد بنجاح.`})
                        })

                    }
                })
            })
        }
    })
}

controllers.fetchUsers = (req, res, next)=>{
    let id = tokenData.id
    let queryReq = req.query;
    let search = queryReq.search
    let offset = queryReq.offset 
    let role = queryReq.role == "employee" ? 3 : queryReq.role == "admin" ? 1 : 2

    query = `SELECT
                id,
                civil,
                first_name AS firstName,
                username,
                phone,
                role
            FROM users
            WHERE id != ${id}
            ${role ? `AND role = ${role}`:''}
            ${search ? `AND (username LIKE '%${search}%' OR civil LIKE '%${search}%' OR id LIKE '%${search}%') `:''}
            ORDER BY created_at DESC
            LIMIT ${limit} 
            OFFSET ${offset}
            `;
    return next();
}
controllers.deleteUsers = (req, res)=>{
    let ids = req.body.ids;
    let query = "DELETE FROM users WHERE id IN (?)"
    dataBase.query(query, [ids], (error, data)=>{
      if(error) return res.json({success:false, msg:'عذراً حدث خطأ في الحذف من جدول المستخدمين!'});
      if(!data.affectedRows) return res.json({success:false, msg:'معذرة, فشلة عملية الحذف من سجل المستخدمين!'})
      res.json({success:true, msg:'تم الحذف بنجاح.'})
    })
}
controllers.fetchOneUser = (req, res)=>{
    const id = req.params.id;
    const query = `SELECT id,
                        username,
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
                    FROM users WHERE id = ?
    `;
    dataBase.query(query, [id], (error, data)=>{
        if(error) return res.json({success:false, msg:"هناك خطأ ما في جلب بيانات المستخدم!"});
        if(!data.length) return res.json({success:false, msg:'عذراً, فشلة عملية جلب بيانات المستخدم!'});
        delete data[0].password
        delete data[0].created_at
        delete data[0].updated_at
        res.json({success:true, data:data});
    })
}
controllers.updateOneUser = (req, res)=>{
    const startUpdate = ()=>{
        const query = `UPDATE users SET ? WHERE id = ?
        AND NOT EXISTS (
            SELECT 1 
            FROM (SELECT * FROM users) AS u 
            WHERE u.username = ? AND u.id != ?
        )`;
        dataBase.query(query, [payload, id, payload.username, id], (error, data)=>{
                        console.log("🚀 ~ file: Users.controller.js:141 ~ dataBase.query ~ error:", error)

            if(error) return res.json({success:false, msg:'عذراً حدث خطأ في تحديث بيانات المستخدم!'});
            if(!data.affectedRows) return res.json({success:false, msg:'معذرة, فشلة عملية تحديث بيانات المستخدم, إحتمال وجود نفس إسم المستخدم الذي ادخلته من قبل!.'});
            res.json({success:true, msg:'تم تحديث بيانات المستخدم بنجاح.'})
        });
        /*
        // This query doesn't works on the online server!
        const query = `UPDATE users SET ? WHERE id = ?
        AND NOT EXISTS (
            SELECT 1 FROM users WHERE username = ? AND id != ?
        )`;
        */
    }
    // Handel Validator Erorrs
    const formError = validationResult(req);
    if (!formError.isEmpty()) {
        let setError = formError.errors[0].msg;
        return res.json({ success: false, msg: setError });
    }
    /*
        Step1: if password : Crypt it
                Step2: Update
            :else
                Step2: Update
    */
    const id = req.params.id // user id
    // Only admin can update anyone.
    if(tokenData.userType != 'admin' && id != tokenData.id) return res.json({success:false, msg:"Soory, you don't have the permission!"});

    const username = req.body.username;
    const password = req.body.password;
    const firstName = req.body.firstName;
    const parentName = req.body.parentName;
    const grandFather = req.body.grandFather;
    const famillyName = req.body.famillyName;
    const fullName = firstName + " " + parentName + " " + grandFather + " " + famillyName;

    const payload = {
        // role:req.body.role,
        username:username,
        full_name:fullName,
        first_name:firstName,
        parent_name:parentName,
        grand_father:grandFather,
        familly_name:famillyName,
        job_title:req.body.jobTitle || username,
        civil:req.body.civil,
        phone:req.body.phone,
    }
    //Step1: if password : Crypt it
    if(password){
        bcrypt.genSalt(10, (err,salt)=>{
            if(err) return console.log("ERROR CATCHED ON genSalt");
            bcrypt.hash(password, salt,null, (err, hash)=>{
                if(err) return console.log("ERROR CATCHED ON bcrypt");
                if(hash){
                    payload.password = hash;
                    //Update
                    return startUpdate();
                }
            })
        })
    }else{
        //Step2: Update
        return startUpdate();
    }

}
module.exports = controllers;
