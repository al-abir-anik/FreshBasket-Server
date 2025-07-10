require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;
// Middlewires
app.use(cors());
app.use(express.json());

// CONNECTION CODE START___
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@root-cluster.yqkit.mongodb.net/?retryWrites=true&w=majority&appName=root-Cluster`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });

    // Collection Names
    const productsCollection = client
      .db("FreshBasket_DB")
      .collection("all-products");
    const userCartCollection = client
      .db("FreshBasket_DB")
      .collection("user-cartlist");

    // ------------- PRODUCT APIS -------------------

    // Load all products
    app.get("/all-products", async (req, res) => {
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
      const cursor = productsCollection.find(query).sort(sortQuery);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get specific product
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    // ------------- USER APIS -------------------

    // post new user cart doc
    app.post("/new-user", async (req, res) => {
      const user = req.body;
      const result = await userCartCollection.insertOne(user);
      res.send(result);
    });

    // load specific user cartlist
    app.get("/user-cartlist", async (req, res) => {
      const email = req.query.email;
      const userDoc = await userCartCollection.findOne({ email });
      const productIds =
        userDoc.cartlist.map((p) => new ObjectId(p.productId)) || [];
      const productQuantity = new Map(
        userDoc.cartlist.map((item) => [item.productId, item.quantity])
      );

      const products = await productsCollection
        .find({ _id: { $in: productIds } })
        .toArray();

      const enrichedCart = products.map((product) => ({
        ...product,
        quantity: productQuantity.get(product._id.toString()),
      }));
      res.send(enrichedCart);
    });

    // add product in user cartlist
    app.post("/add-to-cart", async (req, res) => {
      const { email, productId, quantity = 1 } = req.body;

      const result = await userCartCollection.updateOne(
        { email },
        { $push: { cartlist: { productId, quantity } } }
      );
      res.send(result);
    });

    // update cart product quantity
    app.patch("/update-cart-quantity", async (req, res) => {
      const { email, productId, quantity } = req.body;

      const result = await userCartCollection.updateOne(
        { email, "cartlist.productId": productId },
        { $set: { "cartlist.$.quantity": quantity } }
      );
      res.send(result);
    });

    // delete product from cartlist
    app.patch("/delete-cart-product", async (req, res) => {
      const { email, productId } = req.body;

      const result = await userCartCollection.updateOne(
        { email },
        { $pull: { cartlist: { productId } } }
      );
      res.send(result);
    });

    // ------------- ADMIN APIS -------------------

    // Add a new product
    app.post("/add-product", async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
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
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Products falling from the sky");
});

app.listen(port, () => {
  console.log(`Products are waiting at ${port}`);
});
