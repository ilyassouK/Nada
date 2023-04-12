const controllers = {}
const dataBase = require('../config/DB');
const limit = 10;


controllers.addItem = (req, res)=>{
    /*
        Step0: Check is a storekeeper
        Step1: Create new record in items table
        Step2: Get inserted_id & quntity : Create number of the quntity records in products table
    */
    // Step0: Check is a storekeeper   
    // if(tokenData.userType !== "storekeeper") return res.json({success:false, msg:"عذراً لم تحصل على الإذن بعد."});
    
    // Step1: Create new record in items table
    let payload = {
        class:req.body.class,
        name:req.body.name,
        quantity:req.body.quantity,
        unit:req.body.unit,
        unit_price:req.body.unitPrice,
        total_price:req.body.totalPrice,
    }
    dataBase.getConnection((error, connection)=>{
      if(error){
        connection.release();
        return res.json({success:false, msg:"هناك خطأ ما في إضافة صنف جديد!"});
      }
      
      // 1- Start Transaction
      connection.beginTransaction((error)=>{
        if(error){
          connection.release();
          return res.json({success:false, msg:"هناك خطأ ما في إضافة صنف جديد!"});
        } 
        // Operation
        const createItemQuery = "INSERT INTO items SET ?";
        connection.query(createItemQuery, [payload], (error, data)=>{
          if(error){
            console.log("🚀 ~ file: Items.controller.js:41 ~ connection.query ~ error:", error)
            return connection.rollback(()=>{
              connection.release();
              res.json({success:false, msg:"هناك خطأ ما في إضافة صنف جديد!"})
            })
          } 
          //Step2: Get inserted_id & quntity : Create number of the quntity records in products table
          let id = data.insertId; // Inserted ID
          let quantity = payload.quantity;
          //Generate number of products
          let products = [];
          for(let i=0; i < quantity; i++) products.push({item_id:id})
          //Convert the array of objects to array of arrays
          let sqlValues = products.map(object => Object.values(object))
          
          // Create products
          let createProductsQuery = "INSERT INTO products (item_id) VALUES ?";
          connection.query(createProductsQuery, [sqlValues], (error, data)=>{
              if(error){
                return connection.rollback(()=>{
                  connection.release();
                  res.json({success:false, msg:"هناك خطأ ما في إضافة المنتجات!"})
                })
              }
              
              connection.commit((error)=>{
                if(error){
                  return connection.rollback(()=>{
                    connection.release();
                    res.json({success:false, msg:"هناك خطأ ما في إضافة المنتجات!"})
                  })
                } 
                connection.release();
                // Success, Fin
                return res.json({success:true, msg:"رائع, تم تسجيل و إضافة الصنف الجديد في المستودع بنجاح."})
              })
          })

        })
      });
    });

}
controllers.warehouseItems = (req, res, next)=>{
  let queryReq = req.query;
  let limtLess = queryReq.limtLess ? JSON.parse(queryReq.limtLess) : false; // For the Excel report (to get all rows)
  let search = queryReq.search
  let offset = queryReq.offset 

  query = `SELECT
              id,
              name,
              quantity,
              (quantity - quantityOut) AS restQuantity,
              unit,
              unit_price AS unitPrice,
              total_price AS totalPrice
          FROM items
          ${search ? `WHERE (name LIKE '%${search}%' OR id LIKE '%${search}%') `:''}
          ORDER BY created_at DESC
          ${!limtLess ? `
              LIMIT ${limit} 
              ${offset ? `OFFSET ${offset}`:""}
          `:''}
          `;
  return next();
}
controllers.selectItems = (req, res, next)=>{
    query = "SELECT id, name, quantity, quantityOut FROM items WHERE active = 1"
    return next();
}
controllers.deleteItems = (req, res)=>{
  let ids = req.body.ids;
  let query = "DELETE FROM items WHERE id IN (?)"
  dataBase.query(query, [ids], (error, data)=>{
    if(error) return res.json({success:false, msg:'عذراً حدث خطأ في الحذف من جدول الأصناف!'});
    if(!data.affectedRows) return res.json({success:false, msg:'معذرة, فشلة عملية الحذف من سجل الأصناف!'})
    res.json({success:true, msg:'تم الحذف بنجاح.'})
  })
}
controllers.addNewUnit = (req, res)=>{
  const unit = req.body.unit;
  const query = "INSERT INTO units SET name = ?"
  dataBase.query(query, [unit], (error, data)=>{
    if(error) return res.json({success:false, msg:"حدث خطأ ما اثناء محاولة إضافة الوحدة!"});
    if(!data.affectedRows) return res.json({success:false, msg:"عذراً, فشلة محاولة إضافة الوحدة!"});
    const inserted = {
      id:data.insertId,
      unit:unit
    }
    res.json({success:true, msg:'تم إضافة الوحدة بنجاح', inserted:inserted})
  })
}
controllers.fetchAllUnits = (req, res, next)=>{
  query = "SELECT id, name AS unit FROM units";
  return next();
}
controllers.fetchOneItem = (req, res, next)=>{
  const id = req.params.id; // item id
  const query = `SELECT id,
                      name,
                      quantity,
                      (quantity - quantityOut) AS restQuantity,
                      unit,
                      unit_price AS unitPrice,
                      total_price AS totalPrice
                  FROM items
                  WHERE id = ?
                  `;
  dataBase.query(query, [id], (error, data)=>{
    if(error) return res.json({success:false, msg:"حدث خطأ ما اثناء محاولة جلب بيانات هذا النصف!"});
    if(!data.length) return res.json({success:false, msg:"عفواً, فشلة محاولة جلب بيانات هذا النصف!"});
    res.json({success:true, data:data});
  })
}
controllers.updateItem = (req, res)=>{
  let id = req.params.id; // item id
  /*
    Step1: Update Item
      Step2: If new quantity -> Create records in products table
  */

  const quantity = Number(req.body.quantity);
  const newQuantity = Number(req.body.newQuantity) > 0 || 0;
  const unitPrice = Number(req.body.unitPrice)
  let payload = {
    // class:req.body.class,
    name:req.body.name,
    quantity:quantity + newQuantity,
    unit:req.body.unit,
    unit_price:unitPrice,
    total_price:req.body.totalPrice,
  }
  console.log("🚀 ~ file: Items.controller.js:170 ~ payload:", payload)
  dataBase.getConnection((error, connection)=>{
    if(error){
      connection.release();
      return res.json({success:false, msg:"هناك خطأ ما في تحديث الصنف Eerror:1!"});
    }
    connection.beginTransaction((error)=>{
      if(error){
        connection.release();
        return res.json({success:false, msg:"هناك خطأ ما في تحديث الصنف Eerror:1!"});
      }
      // Step1: Update Item
      const updateItemQuery = "UPDATE items SET ? WHERE id = ?";
      connection.query(updateItemQuery, [payload, id], (error, data)=>{
        
        if(error){
          console.log("🚀 ~ file: Items.controller.js:183 ~ connection.query ~ error:", error)
          return connection.rollback(()=>{
            connection.release();
            res.json({success:false, msg:"حدث خطأ اثناء عميلة تحديث هذا الصنف!"});
          });
        }
        if(!data.affectedRows){
          console.log("🚀 ~ file: Items.controller.js:190 ~ connection.query ~ data.affectedRows:", data.affectedRows)
          return connection.rollback(()=>{
            connection.release();
            res.json({success:false, msg:"عفواً فشلة عميلة تحديث هذا الصنف!"});
          });
        }
        //Step2: If new quantity -> Create records in products table
        if(newQuantity > 0){
          let products = [];
          for(let i=0; i < newQuantity; i++) products.push({item_id:id})
          //Convert the array of objects to array of arrays
          let sqlValues = products.map(object => Object.values(object))
          let createProductsQuery = "INSERT INTO products (item_id) VALUES ?";
          connection.query(createProductsQuery, [sqlValues], (error, data)=>{
              if(error){
                return connection.rollback(()=>{
                  connection.release();
                  res.json({success:false, msg:"هناك خطأ ما في إضافة المنتجات!"})
                })
              }
              
              connection.commit((error)=>{
                if(error){
                  return connection.rollback(()=>{
                    connection.release();
                    res.json({success:false, msg:"هناك خطأ ما في إضافة المنتجات!"})
                  })
                } 
                connection.release();
                // Success, Fin
                return res.json({success:true, msg:"رائع, تم تحديث الصنف و إضافة المنتجات الجديدة في المستودع بنجاح."})
              })
            })
          }else{
            connection.commit((error)=>{
              if(error){
                return connection.rollback(()=>{
                  connection.release();
                  res.json({success:false, msg:"هناك خطأ ما في تحديث بيانات هذا الصنف!"})
                })
              } 
              connection.release();
              // Success, Fin
              return res.json({success:true, msg:"رائع, تم تحديث بيانات الصنف بنجاح."})
            })
        }
      })
    })
  })

}

module.exports = controllers;
