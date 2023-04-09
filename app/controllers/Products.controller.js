const controllers = {}
const con = require('../config/DB');
const dataBase = require('../config/DB');
const limit = 30;


controllers.deliveryProducts = (req, res)=>{
    // Step -1: Check the quantity enough
    // Step0: Get records LIMIT = (quantity's num) from products table by itemsID (Warehouse's products) 
    // Step1: Create new record in transactions table
    // Step2: Update (update multi) from products table [location=1/2]
    // Step3: Update quantityOut in items table (Inc quantityOut)

    let quantity = req.body.quantity;
    let employee = req.body.employee;
    let client = req.body.client;
    let item = req.body.item;
    let location;

    if((!employee && !client) || !quantity) return res.json({success:false, msg:'هناك بعض البيانات مفقودة, الرجاء المحاولة مجدداً.'})
    
    // Step -1: Check the quantity enough [Reset quantity is (quantity-quantityOut)]
    let query = "SELECT id FROM items WHERE id = ? AND (quantity-quantityOut) >= ? AND active = 1";
    dataBase.query(query, [item, quantity], (error, data)=>{
        if(error) return res.json({success:false, msg:"هناك خطأ عند التأكد من كفاية الكمية!"});
        if(!data.length) return res.json({success:false, msg:'فشل نقل العهُد, الكمية غير كافية او الصنف غير معتمد.'})
        // Step0: Get records LIMIT = (quantity's num) from products table by itemsID (Warehouse's products) 
        let query = `SELECT id AS product_id FROM products WHERE item_id = ? AND active = 1 AND location = 0 LIMIT ${quantity}`;
        dataBase.query(query, [item],(error, products)=>{
            if(error) return res.json({success:false, msg:"هناك خطأ ما في جلب الكمية المراد نقلها!"});
            // Insert employee_id / client_id in each object
            if(employee) {
                products.forEach(obj => {obj.employee_id=employee})
                location = 1;
            }else if(client) {
                products.forEach(obj => {obj.client_id=client})
                location = 2;
            }
            // Step1: Create new records in transactions table
    
            //Convert the array of objects to array of arrays
            let sqlValues = products.map(object => Object.values(object))
            
            // DB Transaction : 1. Get connection from Pool
            dataBase.getConnection((error, connection)=>{
              if(error){
                connection.release();
                return res.json({success:false, msg:"هناك خطأ ما في فتح الإتصال لنقل العُهد!"});
              }
              // DB Transaction : 2. Start the Transaction
              connection.beginTransaction((error)=>{
                if(error){
                  connection.release();
                  return res.json({success:false, msg:"هناك خطأ ما في فتح الإتصال لنقل العُهد!"});
                }
                const createTransactionsQuery = `INSERT INTO transactions (product_id, ${employee ? 'employee_id':'client_id'}) VALUES ?`;
                connection.query(createTransactionsQuery, [sqlValues], (error, data)=>{
                  if(error){
                    return connection.rollback(()=>{
                      connection.release();
                      res.json({success:false, msg:"هناك خطأ ما في نقل العُهد!"});
                    })
                  }
  
                  // Step2: Update (update multi) from products table [location=1/2]
                  let productIds = products.map(p => p.product_id).join(",");
                  let updateProductsQuery = `UPDATE products SET location = ? WHERE id IN (${productIds})`
                  connection.query(updateProductsQuery,[location], (error, data)=>{
                    if(error){
                      return connection.rollback(()=>{
                        connection.release();
                        res.json({success:false, msg:"حدث خطأ في تحديث موقع المنتجات!"});
                      })
                    }
                    if (!data.affectedRows) {
                      return connection.rollback(() => {
                        connection.release();
                        res.json({success:false, msg:"فشل تحديث موقع المنتجات!"});
                      });
                    }
  
                    // Step3: Update quantityOut in items table (Inc quantityOut)
                    let updateItemQuery=`UPDATE items SET quantityOut = quantityOut + ? WHERE id = ?`;
                    dataBase.query(updateItemQuery,[quantity, item], (error, data)=>{
                      if(error){
                        return connection.rollback(()=>{
                          connection.release();
                          res.json({success:false, msg:"حدث خطأ ما في تحديث كمية الصنف على المستودع!"});                      
                        })
                      }
                      if(!data.affectedRows){
                        return connection.rollback(() => {
                          connection.release();
                          res.json({success:false, msg:"فشل تحديث كمية الصنف على المستودع!"});                      
                        });
                      }
                      connection.commit((error)=>{
                        if(error){
                          return connection.rollback(()=>{
                            connection.release();
                            res.json({success:false, msg:"هناك خطأ ما في نقل العُهد!"});
                          })
                        }
                        connection.release();
                        return res.json({success:true, msg:"رائع, تم نقل العهُد بنجاح."})
                      })
                    })
  
                  })
                })
              })
            })
        })
    })

}
controllers.fetchTransactions = (req, res, next)=>{
    let id = req.params.id
    // Cant' an employee see other employee's transaction!
    if(tokenData.userType === "employee" && id != tokenData.id) return res.json({success:false, msg:"Soory, but you don't have the permission!"})
    
    let queryReq = req.query;
    let group = queryReq.group; // For client (clients table) || employee (users table)

    let previous = queryReq.previous ? JSON.parse(queryReq.previous) : false;
    let search = queryReq.search
    let offset = queryReq.offset 
    query = `SELECT
                transactions.id,
                transactions.product_id AS productId,
                transactions.employee_id AS employeeId,
                transactions.client_id AS clientId,
                transactions.receipt_date AS receiptDate,
                transactions.return_date AS returnDate,
                transactions.status, 
                ${group == 1 ? `users.full_name AS employeeName,`:`clients.trade_name AS tradeName,`}
                items.id AS itemId,
                items.name AS itemName
            FROM transactions 
                JOIN products ON products.id = transactions.product_id
                JOIN items ON items.id = products.item_id
                ${group == 1 ? 
                  `JOIN users ON users.id = transactions.employee_id
                  WHERE transactions.employee_id = ${id}`
                  :
                  `JOIN clients ON clients.id = transactions.client_id
                  WHERE transactions.client_id = ${id}`
                }
                ${search ? `AND (items.name LIKE '%${search}%' OR transactions.product_id LIKE '%${search}%') `:''}
                ${previous ? 'AND return_date IS NOT NULL':'AND return_date IS NULL'}
                ORDER BY transactions.created_at DESC
                LIMIT ${limit} 
                ${offset ? `OFFSET ${offset}`:""}
            `
    return next();
    // WHERE ${group == 1 ? 'transactions.employee_id':'transactions.client_id'} = ${id}

    // ${search ? `AND (itname LIKE '%${search}%' OR id LIKE '%${search}%') `:''}

}
// Excel
controllers.allTransactionsReport = (req, res, next)=>{
    let id = req.params.id    
    let queryReq = req.query;
    let group = queryReq.group; // For client (clients table) || employee (users table)

    query = `SELECT
                transactions.id,
                transactions.product_id AS productId,
                transactions.employee_id AS employeeId,
                transactions.client_id AS clientId,
                transactions.receipt_date AS receiptDate,
                transactions.return_date AS returnDate,
                transactions.status, 
                ${group == 1 ? `users.full_name AS employeeName,`:`clients.trade_name AS tradeName,`}
                items.name AS itemName
            FROM transactions 
                JOIN products ON products.id = transactions.product_id
                JOIN items ON items.id = products.item_id
                ${group == 1 ? 
                  `JOIN users ON users.id = transactions.employee_id
                  WHERE transactions.employee_id = ${id}`
                  :
                  `JOIN clients ON clients.id = transactions.client_id
                  WHERE transactions.client_id = ${id}`
                }
                ORDER BY transactions.created_at DESC
            `
    return next();
}
controllers.returnBackProducts = (req, res, next) => {
  /*
    Step1: Update (update multi) from products table [location=0]
    Step2: Update transaction table Set return_date
    Step3: Update quantityOut in items table [One / Many items depend the products]  (Dec quantityOut)
  */
  const bodyData = req.body;
  //const productIds = req.body.productIds; // Keep it as Array with parameterized queries [ 91, 92, 93, 94, 95 ]
  const productIds = bodyData.map(obj => obj.productId); // Keep it as Array with parameterized queries [ 91, 92, 93, 94, 95 ]
  dataBase.getConnection((error, connection) => {
    if (error) {
      connection.release();
      return res.json({ success: false, msg: "حدث خطأ في إرجاع العهُد الى المستودع!" });
    }
    connection.beginTransaction((error) => {
      if (error) {
        connection.release();
        return res.json({ success: false, msg: "حدث خطأ في إرجاع العهُد الى المستودع!"});
      }
  
      const updateProductsQuery = `UPDATE products SET location = 0 WHERE id IN (?) AND location != 0`;
      connection.query(updateProductsQuery, [productIds], (error, productsResult) => {
        if (error) {
          return connection.rollback(() => {
            connection.release();
            res.json({ success: false, msg: "حدث خطأ في إرجاع العهُد الى المستودع!"});
          });
        }
  
        if (!productsResult.affectedRows) {
          return connection.rollback(() => {
            connection.release();
            res.json({ success: false, msg: "عذاراً, فشلت عملية إرجاع العهُد الى المستودع, الرجاء المحاولة مجدداً."});
          });
        }
  
        const updateTransactionsQuery = `UPDATE transactions SET return_date = NOW() WHERE product_id IN (?) AND return_date IS NULL`;
        connection.query(updateTransactionsQuery, [productIds], (error, transactionsResult) => {
          if (error) {
            return connection.rollback(() => {
              connection.release();
              res.json({success: false, msg: "حدث خطأ في تحديث تاريخ الإرجاع!"});
            });
          }
  
          if (!transactionsResult.affectedRows) {
            return connection.rollback(() => {
              connection.release();
              res.json({ success: false, msg: "عذاراً, فشلت عملية تسجيل تاريخ الإرجاع!"});
            });
          }
  
          //Step3: Update quantityOut in items table (Dec quantityOut)
          const itemsData = []
          bodyData.forEach((obj)=>{
            const existedItem = itemsData.find(e => e.itemId == obj.itemId);
              if(!existedItem){
                  obj.quantityOut = 1;
                  itemsData.push(obj);
              }else{
                  existedItem.quantityOut = existedItem.quantityOut + 1;
              }
          });
          const VALUES = itemsData.map(({itemId, quantityOut}) => `SELECT ${itemId} AS id, ${quantityOut} AS quantityOut`).join(' UNION ALL\n');
          const updateItemsQuery = `UPDATE items
                                            JOIN (
                                              ${VALUES}
                                            ) AS softTable
                                        ON items.id = softTable.id
                                        SET items.quantityOut = items.quantityOut - softTable.quantityOut;
          `
          // const updateItemsQuery = `UPDATE items JOIN products ON items.id = products.item_id SET quantityOut = quantityOut - ? WHERE products.id IN (?)`;
          const quantity = productsResult.affectedRows;
          console.log("🚀 ~ file: Products.controller.js:243 ~ connection.query ~ productsResult.affectedRows:", productsResult.affectedRows)
          connection.query(updateItemsQuery, [quantity, productIds], (error, itemsResult) => {
            if (error) {
              return connection.rollback(() => {
                connection.release();
                res.json({ success: false, msg: "حدث خطأ في تحديث كمية الصنف على المستودع!"});
              });
            }
  
            connection.commit((error) => {
              if (error) {
                return connection.rollback(() => {
                  connection.release();
                  res.json({ success: false, msg: "حدث خطأ في إرجاع العهُد الى المستودع!"});
                });
              }
              connection.release();
              return res.json({success: true, msg: "رائع, تم إعادة العهُد بنجاح."});
            });
          });
        });
      });
    });

    })
};
controllers.attendingProducts = (req, res)=>{
  if(tokenData.userType != "employee") return res.json({success:false, msg:'Only Employees can make this role'});

  const employeeId = tokenData.id;
  const productId = req.body.productId
  const status = req.body.status;

  // Step1: From the transactions table and based on product_id (barcode) Get the last client_id of that product.
  const findClintQuery = "SELECT client_id FROM transactions WHERE product_id = ? ORDER BY created_at DESC LIMIT 1"
  dataBase.query(findClintQuery, [productId], (error, data)=>{
    if(error) return res.json({success:false, msg:"هناك خطأ ما في إيجاد المحل!"});
    if(!data.length || !data[0].client_id) return res.json({success:false, msg:`عذراً, هذا المنتج (رقم ${productId}) غير مسجل عند اي محل!`})
    const clientId = data[0].client_id

    let trackData = {
      product_id:productId,
      employee_id:employeeId,
      client_id:clientId,
      status:status
    }
    console.log("🚀 ~ file: Products.controller.js:257 attendingProducts ~ trackData:", trackData)
    const saveTrackQuery = "INSERT INTO product_tracking SET ?"
    dataBase.query(saveTrackQuery, [trackData], (error, data)=>{
      console.log(error)
      if(error) return res.json({success:false, msg:"هناك خطأ ما في تسجيل حضور هذا المنتج!"});
      if(data.affectedRows < 1) return res.json({success:false, msg:"فشلت عملية تسجيل حضور هذا المنتج!"});
      console.log("🚀 ~ file: Products.controller.js:263 attendingProducts ~ data.affectedRows:", data.affectedRows)
      res.json({success:true, msg:"رائع, لقد تم تسجيل حضورك على المنتج بنجاح."})
    })
  })
}
controllers.fetchAttendedProducts = (req, res, next)=>{
  let queryReq = req.query;
  let limtLess = queryReq.limtLess ? JSON.parse(queryReq.limtLess) : false; // For the Excel report (to get all rows)
  let search = queryReq.search
  let offset = queryReq.offset;
  let dateFrom = queryReq.dateFrom;
  let dateTo = queryReq.dateTo;
  console.log("🚀 ~ file: Products.controller.js:302 ~ queryReq:", queryReq)
  

  query = `SELECT
                product_tracking.id,
                product_tracking.employee_id AS employeeId,
                product_tracking.product_id AS	productId,
                product_tracking.client_id AS clientId,
                product_tracking.observed_at AS observedAt,
                product_tracking.status,
                items.name AS itemName,
                items.id AS itemId,
                MAX(transactions.receipt_date) AS receiptDate,
                clients.name AS clientName,
                users.full_name AS employeeName,
                clients.trade_name AS tradeName
                FROM product_tracking
                JOIN products ON product_tracking.product_id = products.id
                JOIN items ON products.item_id = items.id
                JOIN transactions ON transactions.product_id = product_tracking.product_id
                JOIN users ON users.id = product_tracking.employee_id
                JOIN clients ON clients.id = product_tracking.client_id
                WHERE 1=1
                ${search ? `AND (clients.city LIKE '%${search}%' OR users.full_name LIKE '%${search}%' OR users.username LIKE '%${search}%' OR users.civil LIKE '%${search}%' )`:''}

                ${tokenData.userType == 'employee' ? `AND product_tracking.employee_id = ${tokenData.id}`:''}
                ${dateFrom && dateTo ? `AND product_tracking.observed_at BETWEEN '${dateFrom}' AND '${dateTo}' `:""}

                GROUP BY product_tracking.id
                ORDER BY product_tracking.created_at DESC
                ${!limtLess ? `
                    LIMIT ${limit} 
                    ${offset ? `OFFSET ${offset}`:""}
                `:''}
                `
                // ${search ? `WHERE (name LIKE '%${search}%' OR id LIKE '%${search}%') `:''}
  return next()
}
controllers.deleteTracked = (req, res)=>{
  let ids = req.body.ids;
  console.log("🚀 ~ file: Products.controller.js:288 ~ controllers.deleteTracked ~ ids:", ids)
  let query = "DELETE FROM product_tracking WHERE id IN (?)"
  dataBase.query(query, [ids], (error, data)=>{
    if(error) return res.json({success:false, msg:'عذراً حدث خطأ في الحذف من سجل التحضير!'});
    if(!data.affectedRows) return res.json({success:false, msg:'معذرة, فشلة عملية الحذف من سجل تحضير المنتجات!'})
    res.json({success:true, msg:'تم الحذف بنجاح.'})
  })
}
controllers.covenant = (req, res)=>{
  if(tokenData.userType === 'employee' && id != tokenData.id) return res.json({success:false, msg:"Soory, you need the permission first."})
  let id = req.params.id; // Employee id
  query = `
    SELECT items.id AS itemId,
            users.full_name AS employeeName,
            users.civil AS employeeCivil,
            users.username AS username,
            items.name AS itemName,
            items.quantity AS restQuantity,
            items.unit,
            items.unit_price AS unitPrice,
            items.total_price AS totalPrice,
            COUNT(transactions.id) AS quantity
    FROM transactions
    JOIN products ON transactions.product_id = products.id
    JOIN items ON items.id = products.item_id
    JOIN users ON users.id = transactions.employee_id
    WHERE transactions.return_date IS NULL
    AND users.id = ?
    GROUP BY items.id
  `
  dataBase.query(query, [id], (error, data)=>{
    if(error) return res.json({success:false, msg:'عذراً حدث خطأ في جلب الأصناف!'});
    if(!data.length) return res.json({success:false, msg:'معذرة, فشلة عملية جلب اصناف الموظف!'});

    res.json({success:true, rows:data})
  })

}
controllers.agreement = (req, res)=>{
  let id = req.params.id; // Client id
  query = `
    SELECT items.id AS itemId,
            clients.name AS clientName,
            clients.trade_name AS tradeName,
            clients.commercial_num AS commercialNum,
            items.name AS itemName,
            items.quantity AS restQuantity,
            items.unit,
            items.unit_price AS unitPrice,
            items.total_price AS totalPrice,
            MAX(transactions.receipt_date) AS receiptDate,
            COUNT(transactions.id) AS quantity
    FROM transactions
    JOIN products ON transactions.product_id = products.id
    JOIN items ON items.id = products.item_id
    JOIN clients ON clients.id = transactions.client_id
    WHERE transactions.return_date IS NULL
    AND clients.id = ?
    GROUP BY items.id
  `
  dataBase.query(query, [id], (error, data)=>{
    if(error) return res.json({success:false, msg:'عذراً حدث خطأ في جلب الأصناف!'});
    if(!data.length) return res.json({success:false, msg:'معذرة, فشلة عملية جلب اصناف المحل!'});

    res.json({success:true, rows:data})
  })
}
controllers.getUsersAndClientsOfItems = (req, res, next)=>{
  const search = req.query.search;
  const commonCondition = `
    JOIN products ON products.id = transactions.product_id
    JOIN items ON items.id = products.item_id
    WHERE items.name LIKE '%${search}%' AND transactions.return_date IS NULL
  `
  query = `
  SELECT items.name AS itemName,
          COUNT(transactions.id) AS COUNT,
          users.id AS employeeId,
          users.full_name AS employeeName,
          users.civil AS employeeCivil,
          users.phone AS employeePhone,

          NULL AS clientId,
          NULL AS tradeName,
          NULL AS commercialNum,
          NULL AS clientCity,
          NULL AS clientPhone
      FROM transactions
      JOIN users ON users.id = transactions.employee_id
      ${commonCondition}
  UNION
  SELECT items.name AS itemName,
          COUNT(transactions.id) AS COUNT,
          NULL AS userId,
          NULL AS employeeName,
          NULL AS employeeCivil,
          NULL AS employeePhone,

          clients.id AS clientId,
          clients.trade_name AS tradeName,
          clients.commercial_num AS commercialNum,
          clients.city AS clientCity,
          clients.phone AS clientPhone
      FROM transactions
      JOIN clients ON clients.id = transactions.client_id
      ${commonCondition}
  `;
  return next();
}
module.exports = controllers;
