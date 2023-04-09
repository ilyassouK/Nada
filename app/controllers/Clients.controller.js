const controllers = {}
const dataBase = require('../config/DB');
const xlsx = require('xlsx');
const {deleteUploadedExcelFile} = require("./Helper.controller");
const limit = 30;


controllers.AddClient = (req, res)=>{
    let payload = {
        name:req.body.name,
        trade_name:req.body.tradeName,
        commercial_num:req.body.commercialNum,
        city:req.body.city,
        phone:req.body.phone
    }
    let query = "INSERT INTO clients SET ?"
    dataBase.query(query, [payload], (error, data)=>{
        if(error || !data.affectedRows){
            console.log("🚀 ~ file: Clients.controller.js:20 ~ dataBase.query ~ error:", error)
            return res.json({success:false, msg:"Erro 3: هناك خطأ ما في إضافة المحل!"});
        }
        return res.json({success:true, msg:`رائع, تم إضافة المحل بنجاح.`})
    })    


}
controllers.fetchClients = (req, res, next)=>{
    let queryReq = req.query;
    let limtLess = queryReq.limtLess ? JSON.parse(queryReq.limtLess) : false; // For the Excel report (to get all rows)
    let search = queryReq.search
    let offset = queryReq.offset 

    query = `SELECT
                id,
                name,
                trade_name AS tradeName,
                commercial_num AS commercialNum,
                city,
                phone
            FROM clients
            ${search ? `WHERE (trade_name LIKE '%${search}%' OR name LIKE '%${search}%' OR commercial_num LIKE '%${search}%' OR id LIKE '%${search}%') `:''}
            ORDER BY created_at DESC
            ${!limtLess ? `
                LIMIT ${limit} 
                ${offset ? `OFFSET ${offset}`:""}
            `:''}
            `;
    return next();
}
controllers.selectClients = (req, res, next)=>{
    query = "SELECT id, city, trade_name AS tradeName FROM clients WHERE active = 1"
    return next();
}
controllers.deleteClients = (req, res)=>{
    let ids = req.body.ids;
    let query = `DELETE FROM clients 
    WHERE id IN (?) 
    AND id NOT IN
        (
            SELECT DISTINCT client_id 
            FROM transactions 
            WHERE client_id IS NOT NULL 
            AND return_date IS NULL
        )
`

    dataBase.query(query, [ids], (error, data)=>{
      if(error) return res.json({success:false, msg:'عذراً حدث خطأ في الحذف من جدول العملاء!'});
      if(!data.affectedRows) return res.json({success:false, msg:'يتطلب اولاً إسترجاع العُهد المسجلة على المحل.'})
      res.json({success:true, msg:'تم الحذف بنجاح.'})
    })
}
controllers.fetchOneClient = (req, res)=>{
    let id = req.params.id;
    query = `SELECT
                    id,
                    name,
                    trade_name AS tradeName,
                    commercial_num AS commercialNum,
                    city,
                    phone
            FROM clients
            WHERE clients.id = ?
            `
    dataBase.query(query, [id], (error, data)=>{
        console.log("🚀 ~ file: Clients.controller.js:140 ~ dataBase.query ~ error:", error)

        if(error) return res.json({success:false, msg:"هناك خطأ ما في جلب بيانات المحل!"});
        if(!data.length) return res.json({success:false, msg:'عذراً, فشلة عملية جلب بيانات المحل!'});
        delete data[0].created_at
        delete data[0].updated_at
        res.json({success:true, data:data});
    })
        

}
controllers.updateOneClient = (req, res)=>{
    const id=req.params.id // client id
    const payload = {
        name:req.body.name,
        trade_name:req.body.tradeName,
        commercial_num:req.body.commercialNum,
        city:req.body.city,
        phone:req.body.phone
    }
    const query = `UPDATE clients SET ? WHERE id = ? 
                            AND NOT EXISTS (
                                SELECT 1 FROM clients WHERE commercial_num = ? AND id != ?
                            )
                    `;
    dataBase.query(query,[payload, id, payload.commercial_num, id], (error, data)=>{
        if(error) return res.json({success:false, msg:'عذراً حدث خطأ في تحديث بيانات المحل!'});
        if(!data.affectedRows) return res.json({success:false, msg:'معذرة, فشلة عملية تحديث بيانات المحل, إحتمال وجود نفس رقم السجل الذي ادخلته من قبل.'});
        res.json({success:true, msg:'تم تحديث بيانات المحل بنجاح.'})
    })
}
controllers.selectaddresses = (req, res, next)=>{
    query = "SELECT DISTINCT city FROM clients";
    return next();
}

controllers.addExcelClients = (req, res)=>{
    /*
        Collect username in Array using map()
            Check in DB that there is no usename exists.
                Collect unique username
    */
    const fileUploaded = req.file.path;
    if(!fileUploaded) return res.json({success:false, msg:'عفواً لم يتم رفع الملف!'})
    // Parse the uploaded Excel file
    const workbook = xlsx.readFile(fileUploaded);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const dataTable = xlsx.utils.sheet_to_json(worksheet);

    if(!dataTable.length || !dataTable[0]['رقم السجل']) return res.json({success:false, msg:'الرجاء رفع جدول بيانات المحلات بشكل الصحيح.'})

    const dataComNum = dataTable.map(obj => obj['رقم السجل']); // return array of الإسم التجاري ['Example','Example','Example']
    
    const checkClients = "SELECT commercial_num AS commercialNum FROM clients WHERE commercial_num IN (?)"
    dataBase.query(checkClients, [dataComNum], (error, results)=>{

        if(error) return res.json({success:false, msg:"هناك خطأ ما في التحقق من الحسابات!"});
        const existingClients = results.map(row => row.commercialNum); // return array of commercialNum ['Example','Example','Example']
        const uniqueClients = dataTable.filter(obj => !existingClients.includes(String(obj['رقم السجل'])));
        if(!uniqueClients.length) return res.json({success:false, msg:"عفواً و لكن هذه الحسابات مسجلة سابقاً."});
        
        const VALUES = uniqueClients.map(obj => [
                obj['الإسم التجاري'],
                obj['رقم السجل'],
                obj['الإسم الكامل'],
                obj['رقم الهاتف'],
                obj['المدينة / المحافظة']
            ]
        );
        const insertClients = "INSERT INTO clients (trade_name, commercial_num, name, phone, city) VALUES ?"
        dataBase.query(insertClients, [VALUES], (error, results)=>{
            // Delete the file uploaded:
            deleteUploadedExcelFile(fileUploaded);
            console.log("🚀 ~ file: Clients.controller.js:115 ~ dataBase.query ~ error:", error)
            if(error) return res.json({success:false, msg:"حدث خطأ ما في إضافة الحسابات!"});
            if(!results.affectedRows) return res.json({success:false, msg:"فشلة عملية إضافة الحسابات!"});
            res.json({success:true, msg:"رائع, تم استيراد و تسجيل البيانات بنجاح", existingClients:existingClients})
        });
    })
}
module.exports = controllers;
