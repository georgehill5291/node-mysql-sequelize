const db = require('../models')
var moment = require('moment')
const Tutorial = db.tutorials
const Op = db.Sequelize.Op
const redis = require('redis')
const redisearch = require('redis-redisearch')
redisearch(redis)

const indexNameTutorial = 'idx:tutorial'

const redisClient = redis.createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_POST,
    password: process.env.REDIS_PASSWORD,
})

// Create and Save a new Tutorial
exports.create = async (req, res) => {
    // Validate request
    if (!req.body.title) {
        res.status(400).json({
            success: false,
            message: 'Content can not be empty!',
        })
        return
    }

    // Create a Tutorial
    const tutorial = {
        title: req.body.title,
        description: req.body.description,
        published: req.body.published ? req.body.published : false,
    }

    try {
        const result = await Tutorial.create(tutorial)
        setCahceTutorial(result)

        res.json({ success: true, message: 'Tutorial created successfully', data: result })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'General Error',
        })
    }
}

// Retrieve all Tutorials from the database.
exports.findAll = async (req, res) => {
    const title = req.query.title

    const options = {
        sortBy: 'createdAt',
        ascending: false,
    }

    try {
        try {
            await _search(`*`, options, (err, result) => {
                if (err) {
                    console.log(err)
                }
                if (title) {
                    result.docs = result.docs.filter((t) =>
                        t.title.toLowerCase().includes(title.toLowerCase())
                    )
                }

                result.totalResults = result.docs.length
                res.json({ success: true, message: 'Successfully', data: result })
            })
        } catch (error) {
            var condition = title ? { title: { [Op.like]: `%${title}%` } } : null
            let uData = await Tutorial.findAll({ where: condition })
            res.json({ success: true, message: 'Successfully', data: uData })
        }
    } catch (error) {
        console.log(error)
        res.status(500).json({
            success: false,
            message: err.message || 'General Error',
        })
    }
}

// Find a single Tutorial with an id
exports.findOne = (req, res) => {
    const id = req.params.id

    Tutorial.findByPk(id)
        .then((data) => {
            res.json({ success: true, message: 'Successfully', data: data })
        })
        .catch((err) => {
            res.status(500).json({
                success: false,
                message: err.message || 'General Error',
            })
        })
}

// Update a Tutorial by the id in the request
exports.update = (req, res) => {
    const id = req.params.id

    Tutorial.update(req.body, {
        where: { id: id },
    })
        .then(async (num) => {
            if (num == 1) {
                const updatedTutorial = await Tutorial.findOne({ id })
                setCahceTutorial(updatedTutorial)
                res.json({ success: true, message: 'Successfully', data: updatedTutorial })
            } else {
                res.status(500).json({
                    success: false,
                    message: `Cannot update Tutorial with id=${id}. Maybe Tutorial was not found or req.body is empty!`,
                })
            }
        })
        .catch((err) => {
            res.status(500).json({
                success: false,
                message: err.message || 'General Error',
            })
        })
}

// Delete a Tutorial with the specified id in the request
exports.delete = (req, res) => {
    const id = req.params.id

    Tutorial.destroy({
        where: { id: id },
    })
        .then((num) => {
            if (num == 1) {
                res.json({ success: true, message: 'Successfully' })
            } else {
                res.status(500).json({
                    success: false,
                    message: `Cannot delete Tutorial with id=${id}. Maybe Tutorial was not found!`,
                })
            }
        })
        .catch((err) => {
            res.status(500).json({
                success: false,
                message: err.message || 'General Error',
            })
        })
}

// Delete all Tutorials from the database.
exports.deleteAll = (req, res) => {
    Tutorial.destroy({
        where: {},
        truncate: false,
    })
        .then((nums) => {
            res.json({ success: true, message: 'Successfully' })
        })
        .catch((err) => {
            res.status(500).json({
                success: false,
                message: err.message || 'General Error',
            })
        })
}

// find all published Tutorial
exports.findAllPublished = (req, res) => {
    Tutorial.findAll({ where: { published: true } })
        .then((data) => {
            res.json({ success: true, message: 'Successfully', data: data })
        })
        .catch((err) => {
            res.status(500).json({
                success: false,
                message: err.message || 'General Error',
            })
        })
}

exports.reIndexAllTutorial = async (req, res) => {
    try {
        const allTutorial = await Tutorial.findAll()
        for (let i = 0; i < allTutorial.length; i++) {
            const item = allTutorial[i]
            setCahceTutorial(item)
            console.log(`reindex tutorial ${item.id} completed`)
        }
        redisClient.ft_drop('idx:tutorial', 'KEEPDOCS')

        redisClient.ft_create(
            'idx:tutorial',
            'ON',
            'hash',
            'PREFIX',
            '1',
            'tutorial:',
            'SCHEMA',
            'title',
            'TEXT',
            'SORTABLE',
            'description',
            'TEXT',
            'published',
            'TEXT',
            'SORTABLE',
            'createdAt',
            'TEXT',
            'SORTABLE',
            'updatedAt',
            'TEXT',
            'SORTABLE'
        )
        res.json({ success: true, message: 'Function Completed' })
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message || 'General Error',
        })
    }
}

const setCahceTutorial = (tutorial) => {
    redisClient.hset(
        `tutorial:${tutorial.id}`,
        'id',
        tutorial.id,
        'title',
        tutorial.title,
        'description',
        tutorial.description,
        'published',
        tutorial.published ? '1' : '0',
        'createdAt',
        moment(tutorial.createdAt).format('yyyyMMDDHHmmss'),
        'updatedAt',
        moment(tutorial.updatedAt).format('yyyyMMDDHHmmss')
    )
}

const _search = async function (queryString, options, callback) {
    let offset = 0 // default values
    let limit = 10 // default value

    // prepare the "native" FT.SEARCH call
    // FT.SEARCH IDX_NAME queryString  [options]
    const searchParams = [
        indexNameTutorial, // name of the index
        queryString, // query string
        'WITHSCORES', // return the score
    ]

    // if limit add the parameters
    if (options.offset || options.limit) {
        offset = options.offset || 0
        limit = options.limit || 10
        searchParams.push('LIMIT')
        searchParams.push(offset)
        searchParams.push(limit)
    }
    // if sortby add the parameters
    if (options.sortBy) {
        searchParams.push('SORTBY')
        searchParams.push(options.sortBy)
        searchParams.push(options.ascending ? 'ASC' : 'DESC')
    }

    console.log(searchParams)

    redisClient.ft_search(searchParams, function (err, searchResult) {
        const totalNumberOfDocs = searchResult[0]
        const result = {
            totalResults: totalNumberOfDocs,
            offset,
            limit,
            queryString,
            docs: [],
            // raw_docs: searchResult,
        }

        // create JSON document from n/v pairs
        for (let i = 1; i <= searchResult.length - 1; i++) {
            const doc = {
                // meta: {
                //     score: Number(searchResult[i + 1]),
                //     id: searchResult[i],
                // },
            }
            i = i + 2
            // doc.fields = {}
            const fields = searchResult[i]
            if (fields) {
                for (let j = 0, len = fields.length; j < len; j++) {
                    const idxKey = j
                    const idxValue = idxKey + 1
                    j++
                    doc[fields[idxKey]] = fields[idxValue]
                }
            }
            result.docs.push(doc)
        }

        callback(err, result)
    })
}
