const controllers = {}
const dataBase = require('../config/DB');
const limit = 30;



controllers.selectEmployees = (req, res, next)=>{
    // query = "SELECT id, full_name AS fullName FROM users WHERE role = 3 AND active = 1"
    query = `SELECT id, 
                    IFNULL(full_name, 
                            CONCAT(first_name,' ',parent_name,' ',grand_father,' ',familly_name)
                    ) AS fullName 
            FROM users
            WHERE role = 3 AND active = 1`
    return next();
}
module.exports = controllers;
