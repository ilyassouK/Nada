const mysql = require('mysql');

// MySQL connection configurations
let con = mysql.createPool({
    connectionLimit : 10,
    host: 'localhost',
    user: 'root',
    password: 'nadA@2030nada',
    database: 'nada_db'
})
module.exports = con;
