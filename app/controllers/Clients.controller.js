const controllers = {}
const dataBase = require('../config/DB');
const limit = 30;


controllers.AddClient = (req, res)=>{
    // Step1: Check if the address doesn't exists
    // step2: Insert Address
    // step3: Insert client with insertedId (of address table)
    // Step4: Insert client with existed id (of address table)
    
    const address = req.body.address;
    let payload = {
        name:req.body.name,
        trade_name:req.body.tradeName,
        commercial_num:req.body.commercialNum,
        city:req.body.city,
        address	:address,
        phone:req.body.phone
    }

    // DB Transaction : 1. Get connection from Pool
    dataBase.getConnection((error, connection)=>{
        if(error){
            connection.release();
            return res.json({success:false, msg:"Erro 1: هناك خطأ ما في إضافة المحل!"});
        }
        // DB Transaction : 2. Start the Transaction
        connection.beginTransaction((error)=>{
            if(error){
                connection.release();
                return res.json({success:false, msg:"Erro 2: هناك خطأ ما في إضافة المحل!"});
            }
            // Step1: Check if the address doesn't exists
            const selectAddress = "SELECT id from clients_addresses WHERE name = ?"
            connection.query(selectAddress, [address], (error, data)=>{
                if(error){
                    return connection.rollback(()=>{
                        connection.release();
                        res.json({success:false, msg:"حدث خطأ اثناء التحقق في العنوان!"});
                    })
                }
                if(!data.length){
                    //step2: Insert Address
                    const insertAddressQuery = "INSERT INTO clients_addresses SET name = ?";
                    connection.query(insertAddressQuery, [address], (error, data)=>{
                        if(error || !data.affectedRows){
                            return connection.rollback(()=>{
                                connection.release();
                                res.json({success:false, msg:"حدث خطأ اثناء إضافة العنوان العنوان!"});
                            })
                        }
                        // step3: Insert client with insertedId (of address table)
                        return insertClinet(data.insertId);
        
                    })
                }else{
                    // Step4: Insert client with existed id (of address table)
                    return insertClinet(data[0].id);
                }

            });
        });
        //////////////////////////////////////////////////
        const insertClinet = (id) =>{
            payload.address_id = id;
            let query = "INSERT INTO clients SET ?"
            connection.query(query, [payload], (error, data)=>{
                if(error || !data.affectedRows){
                    console.log("🚀 ~ file: Clients.controller.js:26 ~ dataBase.getConnection ~ error:", error)

                    return connection.rollback(()=>{
                        connection.release();
                        return res.json({success:false, msg:"Erro 3: هناك خطأ ما في إضافة المحل!"});
                    })
                }
                connection.commit((error)=>{
                    if(error){
                        return connection.rollback(()=>{
                            connection.release();
                            res.json({success:false, msg:"Erro 4: هناك خطأ ما في إضافة المحل!"});
                        })
                    }
                    connection.release();
                    return res.json({success:true, msg:`رائع, تم إضافة المحل بنجاح.`})
                })
            })    
        }
        //////////////////////////////////////////////////
        });
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
    query = "SELECT id, trade_name AS tradeName, address_id AS addressId  FROM clients WHERE active = 1"
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
                clients.id,
                clients.name,
                clients.trade_name AS tradeName,
                clients.commercial_num AS commercialNum,
                clients.city,
                clients.phone,
                clients.address_id AS addressId,
                clients_addresses.name AS address
            FROM clients
            JOIN clients_addresses ON clients.address_id = clients_addresses.id
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
        address_id	:req.body.addressId,
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
    query = "SELECT id, name AS address FROM clients_addresses";
    return next();
}
module.exports = controllers;
