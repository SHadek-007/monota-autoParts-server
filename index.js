const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


// middleware 
app.use(cors());
app.use(express.json());

function verifyJWT (req,res,next){
    const authHeader = req.headers.authorization;
    if(!authHeader){
      return res.status(401).send({message:'UnAuthorize Access'})
    };
    const token = authHeader.split(" ")[1];
    jwt.verify(token,process.env.ACCESS_TOKEN, function(err, decoded) {
      if(err){
        return res.status(403).send({message:'Forbidden Access'})
      }
      req.decoded = decoded;
      next();
    });
  }

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.irmxy.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try{
        await client.connect();
        const productCollection = client.db('monota-autoParts').collection('product');
        const orderCollection = client.db('monota-autoParts').collection('orders');
        const paymentCollection = client.db('monota-autoParts').collection('payments');
        const reviewCollection = client.db("monota-autoParts").collection("review");
        const userCollection = client.db('monota-autoParts').collection('users');

        const verifyAdmin = async (req, res, next) => {
          const requester = req.decoded.email;
          const requesterAccount = await userCollection.findOne({ email: requester });
          if (requesterAccount.role === 'admin') {
            next();
          }
          else {
            res.status(403).send({ message: 'forbidden' });
          }
        }

        app.get('/product', async(req,res)=>{
            const query = {};
            const cursor = productCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        });

        // single product details api
        app.get("/product/:id", async (req, res) => {
          const id = req.params.id;
          const query = { _id: ObjectId(id) };
          const product = await productCollection.findOne(query);
          res.send(product);
        });
        // count increase api
        app.put("/product/increase/:id", async (req, res) => {
          const id = req.params.id;
          const query = { _id: ObjectId(id) };
          const product = await productCollection.findOne(query);
          const newQuantity =
            parseInt(product.mquantity) + parseInt(req.body.mquantity);
          await productCollection.updateOne(query, {
            $set: { mquantity: newQuantity + "" },
          });
          res.send(product);
        });

        // count decrease api
      app.put("/product/decrease/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const product = await productCollection.findOne(query);
        const newQuantity = parseInt(product.mquantity) - 1;
        await productCollection.updateOne(query, {
          $set: { mquantity: newQuantity + "" },
        });
        res.send(product);
    });

    // order submit api
    app.post('/order', async(req,res)=>{
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });

    // order load on My Order
    app.get('/order', async(req,res)=>{
      const orderUser = req.query.orderUser;
      const query = {orderUser : orderUser};
      const orders = await orderCollection.find(query).toArray();
      res.send(orders);
    });

    // order api for pay jwt
    app.get('/order/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: ObjectId(id)};
      const order = await orderCollection.findOne(query);
      res.send(order);
    });

    //payment api , verifyJWT
    app.post('/create-payment-intent', async(req, res) =>{
      const product = req.body;
      const price = product.price;
      const amount = price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency: 'usd',
        payment_method_types:['card']
      });
      res.send({clientSecret: paymentIntent.client_secret})
    });

    //payment update api, verifyJWT
    app.patch('/order/:id', async(req,res)=>{
      const id = req.params.id;
      const payment = req.body;
      const filter = {_id: ObjectId(id)};
      const updateDoc = {
        $set:{
          paid:true,
          transactionId:payment.transactionId,
        }
      }
      const result = await paymentCollection.insertOne(payment);
      const updatedOrder = await orderCollection.updateOne(filter,updateDoc);
      res.send(updateDoc)
    });

    // delete order verifyadmin
    app.delete('/order/:email', async (req, res) => {
      const email = req.params.email;
      const filter = {email:email}
      const result = await orderCollection.deleteOne(filter);
      res.send(result);
    });

    // submit review api
    app.post('/review', async(req,res)=>{
      const item = req.body;
      const result = await reviewCollection.insertOne(item);
      // res.send({...item,_id:result.insertedId});
      res.send(result)
    });

    // load review on review component
    app.get('/review', async(req,res)=>{
      const query = {};
      const cursor = reviewCollection.find(query);
      const reviews = await cursor.toArray();
      res.send(reviews);
    });

    // useAdmin api
    app.get('/admin/:email', async(req, res)=>{
      const email = req.params.email;
      const user = await userCollection.findOne({email:email});
      const isAdmin = user.role === 'admin';
      res.send({admin:isAdmin});
    });

    //all user api
    app.put('/user/:email', async(req, res)=>{
      const email = req.params.email;
      const user = req.body;
      const filter = { email:email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      var token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1d' });
      res.send({result, token});
    });

    //get all user in All User in Dashboard Component
    app.get('/user', verifyJWT, async(req, res)=>{
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    //admin create api in make admin component
    app.put('/user/admin/:email', verifyJWT, verifyAdmin, async(req, res)=>{
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: 'admin' },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    
    }
    finally{

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Monota Auto Parts is Running')
  })
  
  app.listen(port, () => {
    console.log(`Monota Auto Parts listening on port ${port}`)
  })