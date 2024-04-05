const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken');
const app = express()
const port = process.env.PORT || 5000;


// middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4lef0mm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const userCollections = client.db("beautyParlorDB").collection("users");
        const reviewCollections = client.db("beautyParlorDB").collection("reviews");
        const serviceCollections = client.db("beautyParlorDB").collection("services");
        const bookingCollections = client.db("beautyParlorDB").collection("bookings");


        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, {
                expiresIn: '1h',
            })
            res.send({ token })
        })

        // middlewares
        const verifyToken = async (req, res, next) => {
            console.log('inside verify token', req.headers)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1]

            jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next()
            })

        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollections.findOne(query)
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }


        // users related api
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const users = await userCollections.find().toArray()
            res.send(users)
        })

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (!email === req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const query = { email: email };
            const user = await userCollections.findOne(query)
            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            // user email check for existing; 
            const query = { email: user.email };
            const existing = await userCollections.findOne(query)
            if (existing) {
                return res.send({ message: 'user already exists' })
            }

            const result = await userCollections.insertOne(user)
            res.send(result)
        })

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollections.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollections.deleteOne(query)
            res.send(result)
        })



        app.get('/services', async (req, res) => {
            const services = await serviceCollections.find().toArray()
            res.send(services)
        })

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const query = { _id: new ObjectId(id) }
            const result = await serviceCollections.findOne(query)
            res.send(result);
        })

        app.post('/services', verifyToken, verifyAdmin, async (req, res) => {
            const service = req.body;
            const result = await serviceCollections.insertOne(service)
            res.send(result)
        })


        // Reviews related api
        app.get('/reviews', async (req, res) => {
            const reviews = await reviewCollections.find().toArray()
            res.send(reviews)
        })

        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewCollections.insertOne(review);
            res.send(result)
        })





        // booking related api
        app.get('/bookings', verifyToken, verifyAdmin, async (req, res) => {
            const booking = await bookingCollections.find().toArray()
            res.send(booking)
        })

        app.get('/bookings/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await bookingCollections.find(query).toArray()
            res.send(result)
        })

        app.post('/bookings', verifyToken, async (req, res) => {
            const book = req.body;
            console.log(book)
            const result = await bookingCollections.insertOne(book)
            res.send(result)
        })



        // Payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount, 'inside of intent')

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);





app.get('/', async (req, res) => {
    res.send('Beauty is Running')

})

app.listen(port, () => {
    console.log(`Beauty is Running on ${port}`)
})