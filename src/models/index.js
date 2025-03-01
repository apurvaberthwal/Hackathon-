const mysql = require('mysql2');
const dbConfig = require('../config/database');

const connection = mysql.createConnection(dbConfig);

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MySQL database.');
});

module.exports = {
    query: (sql, params) => {
        return new Promise((resolve, reject) => {
            connection.query(sql, params, (err, results) => {
                if (err) {
                    return reject(err);
                }
                resolve(results);
            });
        });
    },
    close: () => {
        return new Promise((resolve, reject) => {
            connection.end((err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }
};