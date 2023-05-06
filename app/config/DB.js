const mysql = require('mysql');

// MySQL connection configurations
let con = mysql.createPool({
    connectionLimit : 10,
    host: 'localhost',
    user: 'root',
    password: '',
    password: 'nadaDB@2030',
    database: 'nada_db'
})
module.exports = con;
