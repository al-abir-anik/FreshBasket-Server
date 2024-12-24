const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

// Middlewires
app.use(cors());
app.use(express.json());

// CONNECTION CODE START___
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@foodbridge-cluster.cxkdi.mongodb.net/?retryWrites=true&w=majority&appName=FoodBridge-Cluster`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // Food Related APIs...............
    const foodCollection = client
      .db("FoodBridge")
      .collection("food_collection");

    // To load all foods
    app.get("/foods", async (req, res) => {
      const cursor = foodCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    // To get specific Food
    app.get("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodCollection.findOne(query);
      res.send(result);
    });
    // Add a new Movie
    app.post("/foods", async (req, res) => {
      const newFood = req.body;
      const result = await foodCollection.insertOne(newFood);
      res.send(result);
    });



  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// ....

app.get("/", (req, res) => {
  res.send("Food is falling from the sky");
});

app.listen(port, () => {
  console.log(`Job is waiting at ${port}`);
});
