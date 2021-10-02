require('dotenv').config()
const express = require('express')
// create express app
const app = express()

// Setup server port
const port = process.env.PORT || 4000 //mysql
// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }))
// parse requests of content-type - application/json
app.use(express.json())

// const redisClient = redis.createClient(redisUrl)
// redisClient.on('connect', () => {
//     console.log(`Connected to Redis on port ${redisUrl}.`)
// })

const db = require('./app/models')
db.sequelize.sync()
// db.sequelize.sync({ force: true }).then(() => {
//     console.log('Drop and re-sync db.')
// })

// define a root route
// app.get('/', (req, res) => {
//     res.send('Hello G-MYSQL')
// })

require('./app/routes/turorial.routes')(app)

// listen for requests
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`)
})
