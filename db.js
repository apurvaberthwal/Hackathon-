import mysql from 'mysql2/promise';

const facultyDb= mysql.createPool({
    host: "localhost",
    user: "root",
    password: "pass",
    database: "hackathon"
  });

export default facultyDb;
