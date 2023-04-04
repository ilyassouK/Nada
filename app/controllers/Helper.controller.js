const controllers = {}
const dataBase = require('../config/DB');
const fs = require('fs');

controllers.deleteUploadedExcelFile = (fileUploaded)=>{
    fs.unlink(fileUploaded, (err)=>{
        if(err) console.log("Failed delete the uploaded file ", err);
        console.log("Well, the uploaded file has been successfully removed")
    })
}

controllers.nextDbProccess = (req, res)=>{
    if(!msg){var msg='لم يتم إيجاد اي معلومات لعرضها.'}
    dataBase.query(query, (error, data)=>{

        if(error) return res.json({success:false, msg:"حدث خطأ ما, الرجاء التحقق من الإتصال, و إعادة المحاولة."});
        if(!data.length) return res.json({success:false, msg:msg});
        if(data[0].password) delete data[0].password
        if(data[0].created_at) delete data[0].created_at
        if(data[0].updated_at) delete data[0].updated_at
        if(data[0].updated_at) delete data[0].password
        return res.json({success:true, rows: data});
    })
}

module.exports = controllers