const mysql = require('mysql');

// MySQL connection configurations
let con = mysql.createPool({
    connectionLimit : 10,
    host: '127.0.0.1',
    user: 'root',
    // password: '',
    password: 'nadaDB@2030',
    database: 'nada_db'
})
module.exports = con;