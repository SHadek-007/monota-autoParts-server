const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware 
app.use(cors());
app.use(express.json());

function verifyJWT (req,res,next){
    const authHeader = req.headers.authorization;
    if(!authHeader){
      return res.status(401).send({message:'UnAuthorize Access'})
    };
    const token = authHeader.split(" ")[1];
    jwt.verify(token,process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
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