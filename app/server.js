const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");

// Routes
const apiRoutes = require('./routes/Api.js')
const authRoutes = require('./routes/Auth.js')
// const auth = require('./routes/Auth.js')
app.use(cors());
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

// Enable this routes
app.use('/api', apiRoutes)
app.use('/auth', authRoutes)

const data = [{
    "id": 56,
    "productId": 38,
    "receiptDate": "2023-03-21T10:36:22.000Z",
    "clientName": "اسم كامل",
  },
  {
    "id": 55,
    "productId": 46,
    "receiptDate": "2023-03-21T10:31:10.000Z",
    "clientName": "اسم كامل",
  }]

const findTarget = data.find(obj => obj.productId == 38);
const recipient = findTarget?.employeeName || findTarget?.clientName
const receiptDate = findTarget?.receiptDate;
// console.log("🚀 ~ file: server.js:20 ~ obj:", findTarget)
console.log("🚀 ~ file: server.js:20 ~ obj:", recipient,receiptDate)

const PORT = process.env.PORT || 1880;
app.listen(PORT, ()=>{
    console.log(`Server is running on PORT: ${PORT}`)
})