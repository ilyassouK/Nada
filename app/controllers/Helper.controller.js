const controllers = {}
const dataBase = require('../config/DB');



controllers.nextDbProccess = (req, res)=>{
    if(!msg){var msg='لم يتم إيجاد اي معلومات لعرضها.'}
    dataBase.query(query, (error, data)=>{
        console.log("🚀 ~ file: Helper.controller.js:9 ~ dataBase.query ~ error:", error)

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