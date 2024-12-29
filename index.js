require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
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
    // await client.connect();
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // Food Related APIs...............
    const foodCollection = client.db("FoodBridge").collection("foods");
    const requestedFoodCollection = client
      .db("FoodBridge")
      .collection("requestedFoods");

    // Load all foods
    app.get("/foods", async (req, res) => {
      const sort = req.query.sort;
      const search = req.query.search;
      let sortQuery = {};
      let query = {};
      if (sort == "true") {
        sortQuery = { expireDate: -1 };
      }
      if (search) {
        query.foodName = { $regex: search, $options: "i" };
      }
      const cursor = foodCollection.find(query).sort(sortQuery);
      const result = await cursor.toArray();
      res.send(result);
    });
    // Featured Foods sorting by quantity
    app.get("/featuredFoods", async (req, res) => {
      const cursor = foodCollection.find().sort({ quantity: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get specific Food
    app.get("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodCollection.findOne(query);
      res.send(result);
    });
    // Add a new Food
    app.post("/foods", async (req, res) => {
      const newFood = req.body;
      const result = await foodCollection.insertOne(newFood);
      res.send(result);
    });
    // Get Food of specific users
    app.get("/userFoods", async (req, res) => {
      const email = req.query.email;
      const query = {
        userEmail: email,
      };
      const result = await foodCollection.find(query).toArray();
      res.send(result);
    });
    // Update a Food
    app.put("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedFood = req.body;
      const food = {
        $set: {
          foodName: updatedFood.foodName,
          imageUrl: updatedFood.imageUrl,
          quantity: updatedFood.quantity,
          location: updatedFood.location,
          expireDate: updatedFood.expireDate,
          notes: updatedFood.notes,
        },
      };
      const result = await foodCollection.updateOne(filter, food, options);
      res.send(result);
    });
    // Delete a food
    app.delete("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodCollection.deleteOne(query);
      res.send(result);
    });

    // Move a food to Requested_foods
    app.post("/requestedFoods", async (req, res) => {
      const { id, userEmail, requestDate, notes } = req.body;

      const query = { _id: new ObjectId(id) };
      const food = await foodCollection.findOne(query);

      // Remove the food from the available collection
      // await foodCollection.deleteOne(query);

      // Add the food to the requested collection
      const requestedFood = {
        ...food,
        userEmail,
        notes,
        requestDate,
        status: "requested",
      };
      const result = await requestedFoodCollection.insertOne(requestedFood);
      res.send(result);
    });

    // Get Specific user Requested foods
    app.get("/requestedFoods", async (req, res) => {
      const email = req.query.email;
      const query = {
        userEmail: email,
      };
      const result = await requestedFoodCollection.find(query).toArray();

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
