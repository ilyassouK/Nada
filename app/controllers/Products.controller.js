const controllers = {}
const con = require('../config/DB');
const dataBase = require('../config/DB');
const limit = 10;


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
    let search = queryReq.search;
    let offset = queryReq.offset;

    let commonQuery = `FROM transactions 
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
                          ORDER BY transactions.created_at DESC`;
    let countQuery = `SELECT COUNT(transactions.id) AS totalRows ${commonQuery}`;
    let selectQuery = `SELECT
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
                          ${commonQuery}
                          LIMIT ${limit} 
                          ${offset ? `OFFSET ${offset}`:""}
                          `;

    let totalRows;
    dataBase.query(countQuery, (error, data)=>{
        if(error) return res.json({success:false, msg:"حدث خطأ ما في جلب عدد سجل التحضير."});
        if(!data.length) return res.json({success:false, msg:'لم يتم إيجاد اي معلومات لعرضها.'});
        totalRows = data[0].totalRows
        // Data query
        dataBase.query(selectQuery, (error, data)=>{
            if(error) return res.json({success:false, msg:"حدث خطأ ما في جلب سجل التحضير."});
            if(!data.length) return res.json({success:false, msg:'لم يتم إيجاد اي معلومات لعرضها.'});
            return res.json({success:true, totalRows:totalRows, rows: data})
        })
    })
                      
    /*
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
    */
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
  const productId = req.body.productId;
  const status = req.body.status;
  const latitude = req.body.latitude;
  const longitude = req.body.longitude;

  // Step1: From the transactions table and based on product_id (barcode) Get the last client_id of that product.
  const findClintQuery = "SELECT client_id FROM transactions WHERE product_id = ? ORDER BY created_at DESC LIMIT 1"
  dataBase.query(findClintQuery, [productId], (error, data)=>{
    if(error) return res.json({success:false, msg:"هناك خطأ ما في إيجاد المحل!"});
    if(!data.length || !data[0].client_id) return res.json({success:false, msg:`عذراً, هذا المنتج (رقم ${productId}) غير مسجل عند اي محل!`})
    
    const clientId = data[0].client_id;

    let trackData = {
      product_id:productId,
      employee_id:employeeId,
      client_id:clientId,
      status:status,
      latitude:latitude,
      longitude:longitude,
    }
    const saveTrackQuery = "INSERT INTO product_tracking SET ?"
    dataBase.query(saveTrackQuery, [trackData], (error, data)=>{
      if(error) return res.json({success:false, msg:"هناك خطأ ما في تسجيل حضور هذا المنتج!"});
      if(data.affectedRows < 1) return res.json({success:false, msg:"فشلت عملية تسجيل حضور هذا المنتج!"});
      // console.log("🚀 ~ file: Products.controller.js:263 attendingProducts ~ data.affectedRows:", data.affectedRows)
      res.json({success:true, msg:"رائع, لقد تم تسجيل حضورك على المنتج بنجاح."})
    })
  })
}
controllers.fetchAttendedProducts = (req, res)=>{
  let queryReq = req.query;
  let limtLess = queryReq.limtLess ? JSON.parse(queryReq.limtLess) : false; // For the Excel report (to get all rows)
  let searchClinet = queryReq.searchClinet;
  let searchEmployee = queryReq.searchEmployee;
  let searchItem = queryReq.searchItem;
  let search = queryReq.searchClinet || queryReq.searchEmployee || queryReq.searchItem;
  let date = queryReq.date;
  
  let offset = queryReq.offset;
  /*
    Server : ORDER BY observed_at DESC
    Localhost : ORDER BY observed_at [OR nothing (No ORDER)]
  */
  const commonQuery = `FROM
                          (
                            SELECT id, item_id
                            FROM products
                            WHERE location = 2
                          ) p
                          JOIN items i ON p.item_id = i.id
                          JOIN transactions t ON p.id = t.product_id
                          JOIN clients c ON t.client_id = c.id
                          LEFT JOIN (
                            SELECT product_id, observed_at AS observed_at, status AS status, employee_id AS employee_id, latitude AS latitude, longitude AS longitude
                            FROM product_tracking
                            GROUP BY product_id, observed_at
                            ORDER BY observed_at DESC
                          ) pt ON p.id = pt.product_id
                          LEFT JOIN (
                            SELECT product_id, observed_at AS searchedDate, status AS searchedStatus, employee_id AS searchedEmployee, latitude AS searchedLatitude, longitude AS searchedLongitude
                            FROM product_tracking
                            WHERE observed_at BETWEEN '${date} 00:00:00' AND '${date} 23:59:59'
                            ORDER BY observed_at DESC
                          ) sd ON p.id = sd.product_id
                          LEFT JOIN users u ON u.id = COALESCE(sd.searchedEmployee, pt.employee_id)
                          WHERE 1=1 
                        ${search ? `
                        AND ${searchClinet ? `c.city LIKE '%${searchClinet}%'` : "1=1"}
                        AND ${searchEmployee ? `u.full_name LIKE '%${searchEmployee}%'` : "1=1"}
                        AND ${searchItem ? `i.name LIKE '%${searchItem}%'` : "1=1"}
                      `: ''}

                      ${tokenData.userType == 'employee' ? `AND pt.employee_id = ${tokenData.id}`:''}
                    `;

  const selectTotalRows = `SELECT COUNT(DISTINCT p.id) AS totalRows ${commonQuery} `;
  const selectColumns = `SELECT
                            p.id AS id,
                            p.item_id AS itemId,
                            i.name AS itemName,

                            CASE
                              WHEN searchedDate IS NULL THEN ${!date ? "COALESCE(pt.observed_at, '')":"''"}
                              ELSE searchedDate
                            END AS observedAt,
                            
                            CASE
                              WHEN searchedStatus IS NULL THEN ${!date ? "COALESCE(pt.status, 'لم يُحضر')":"'لم يُحضر'"}
                              ELSE searchedStatus
                            END AS status,
                            
                            CASE
                              WHEN searchedLatitude IS NULL THEN ${!date ? "COALESCE(pt.latitude, '')":"''"}
                              ELSE searchedLatitude
                            END AS latitude,

                            CASE
                              WHEN searchedLongitude IS NULL THEN ${!date ? "COALESCE(pt.longitude, '')":"''"}
                              ELSE searchedLongitude
                            END AS longitude,

                            CASE
                              WHEN searchedEmployee IS NULL THEN ${!date ? "COALESCE(u.full_name, 'لم يُحضر')":"'لم يُحضر'"}
                              ELSE u.full_name
                            END AS employeeName,
                            
                            COALESCE(sd.searchedEmployee, pt.employee_id) AS employeeId,
                            t.receipt_date AS receiptDate,
                            t.client_id AS clientId,
                            c.name AS clientName,
                            c.trade_name AS tradeName
                          ${commonQuery}
                          GROUP BY p.id
                          ORDER BY COALESCE(pt.observed_at, t.receipt_date) DESC

                          ${!limtLess ? `
                              LIMIT ${limit} 
                              ${offset ? `OFFSET ${offset}`:""}
                          `:''}`

  let totalRows;
  // console.log("🚀 ~ file: Products.controller.js:470 ~ dataBase.query ~ selectTotalRows:", selectColumns)
  dataBase.query(selectTotalRows, (error, data)=>{
    if(error) return res.json({success:false, msg:"حدث خطأ ما في جلب عدد سجل التحضير."});
    if(!data.length) return res.json({success:false, msg:'لم يتم إيجاد اي معلومات لعرضها1.'});
    totalRows = data[0].totalRows
    // Data query
    dataBase.query(selectColumns, (error, data)=>{
      if(error) return res.json({success:false, msg:"حدث خطأ ما في جلب سجل التحضير."});
      if(!data.length) return res.json({success:false, msg:'لم يتم إيجاد اي معلومات لعرضها.'});
      return res.json({success:true, totalRows:totalRows, rows: data})
    })
  })
}
controllers.deleteTracked = (req, res)=>{
  let ids = req.body.ids;
  let query = "DELETE FROM product_tracking WHERE id IN (?)"
  dataBase.query(query, [ids], (error, data)=>{
    if(error) return res.json({success:false, msg:'عذراً حدث خطأ في الحذف من سجل التحضير!'});
    if(!data.affectedRows) return res.json({success:false, msg:'معذرة, فشلة عملية الحذف من سجل تحضير المنتجات!'})
    res.json({success:true, msg:'تم الحذف بنجاح.'})
  })
}
controllers.covenant = (req, res)=>{
  let id = req.params.id; // Employee id
  if(tokenData.userType === 'employee' && id != tokenData.id) return res.json({success:false, msg:"Soory, you need the permission first."})
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
      GROUP BY items.name, users.id, users.full_name, users.civil, users.phone
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
      GROUP BY items.name, clients.id, clients.trade_name, clients.commercial_num, clients.city, clients.phone;

  `;
  return next();
}
controllers.addProductStatus = (req, res)=>{
  const status = req.body.status || null;
  if(!status) res.json({success:false, msg:'الرجاء تعبئة حقل الحالة.'});
  const query = "INSERT INTO product_status SET status = ?";
  dataBase.query(query, [status], (error, data)=>{
    if(error) return res.json({success:false, msg:"حدث خطأ ما في تسجيل الحالة!"})
    if(!data.affectedRows) return res.json({success:false, msg:"حدث خطأ ما في تسجيل الحالة!"});
    const insertedData = {
      id:data.insertId,
      status: status
    }
    return res.json({success:true, msg:"جيد تم إضافة الحالة الى القائمة بنجاح", insertedData:insertedData});
  })
}
controllers.fetchProductsStatus = (req, res, next) => {
  query = "SELECT id, status FROM product_status";
  return next();
}
controllers.deleteStatus = (req, res)=>{
  const ids = req.body.ids;
  let query = "DELETE FROM product_status WHERE id IN (?)"
  dataBase.query(query, [ids], (error, data)=>{
    if(error) return res.json({success:false, msg:'عذراً حدث خطأ في الحذف من سجل الحالات!'});
    if(!data.affectedRows) return res.json({success:false, msg:'معذرة, فشلة عملية الحذف من سجل الحالات!'})
    res.json({success:true, msg:'تم الحذف بنجاح.'})
  })

}
module.exports = controllers;
