const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");

// Routes
const apiRoutes = require('./routes/Api.js')
const authRoutes = require('./routes/Auth.js')

app.use(cors());
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

// Enable this routes
app.use('/api', apiRoutes)
app.use('/auth', authRoutes)

app.use(express.static(__dirname + '/public/'));
app.get(/.*/, (req, res) => res.sendFile(__dirname + '/public/index.html'));

const PORT = process.env.PORT || 1880;
app.listen(PORT, ()=>{
    console.log(`Server is running on PORT: ${PORT}`)
})