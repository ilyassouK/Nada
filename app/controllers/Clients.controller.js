const controllers = {}
const dataBase = require('../config/DB');
const limit = 30;


controllers.AddClient = (req, res)=>{
    let payload = {
        name:req.body.name,
        trade_name:req.body.tradeName,
        commercial_num:req.body.commercialNum,
        city:req.body.city,
        address	:req.body.address,
        phone:req.body.phone
    }
    let query = "INSERT INTO clients SET ?"
    dataBase.query(query, [payload], (error, data)=>{
        if(error) return res.json({success:false, msg:"هناك خطأ ما في إضافة المحل!"});
        return res.json({success:true, msg:`رائع, تم إضافة المحل بنجاح.`})

    })
}

controllers.fetchClients = (req, res, next)=>{
    let queryReq = req.query;
    let search = queryReq.search
    let offset = queryReq.offset 

    query = `SELECT
                id,
                name,
                trade_name AS tradeName,
                commercial_num AS commercialNum,
                city,
                address,
                phone
            FROM clients
            ${search ? `WHERE (trade_name LIKE '%${search}%' OR name LIKE '%${search}%' OR id LIKE '%${search}%') `:''}
            ORDER BY created_at DESC
            LIMIT ${limit} 
            OFFSET ${offset}
            `;
    return next();
}

controllers.selectClients = (req, res, next)=>{
    query = "SELECT id, trade_name AS tradeName FROM clients WHERE active = 1"
    return next();
}
controllers.deleteClients = (req, res)=>{
    let ids = req.body.ids;
    let query = "DELETE FROM clients WHERE id IN (?)"
    dataBase.query(query, [ids], (error, data)=>{
      if(error) return res.json({success:false, msg:'عذراً حدث خطأ في الحذف من جدول العملاء!'});
      if(!data.affectedRows) return res.json({success:false, msg:'معذرة, فشلة عملية الحذف من سجل العملاء!'})
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
                address,
                phone
            FROM clients
            WHERE id = ?
            `
    dataBase.query(query, [id], (error, data)=>{
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
        address	:req.body.address,
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
module.exports = controllers;
