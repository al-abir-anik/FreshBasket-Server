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
    // await client.connect();
    // await client.db("admin").command({ ping: 1 });

    // Collection Names
    const productsCollection = client
      .db("FreshBasket_DB")
      .collection("all-products");
    const usersCollection = client.db("FreshBasket_DB").collection("users");

    // ------------- PRODUCT APIS -------------------

    // Load all products
    app.get("/all-products", async (req, res) => {
      const search = req.query.search;
      const category = req.query.category;
      let query = {};

      if (search) {
        query.name = { $regex: search, $options: "i" };
      }
      if (category && category !== "undefined") {
        query.category = new RegExp(`^${category}$`, "i"); // case-insensitive match
      }

      const result = await productsCollection.find(query).toArray();
      res.send(result);
    });

    // load specific product
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    // Load best seller products
    app.get("/best-seller", async (req, res) => {
      const cursor = productsCollection.find({}).sort({ rating: -1 }).limit(10);
      const result = await cursor.toArray();
      res.send(result);
    });

    // load related products by category
    app.get("/related-products", async (req, res) => {
      const id = req.query.id;
      const product = await productsCollection.findOne({
        _id: new ObjectId(id),
      });

      const relatedProducts = await productsCollection
        .find({
          category: product.category,
          _id: { $ne: new ObjectId(id) },
        })
        .limit(5)
        .toArray();

      res.send(relatedProducts);
    });

    // ------------- USER APIS -------------------

    // post new user doc
    app.post("/new-user", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // load current user doc
    app.get("/user-doc", async (req, res) => {
      const email = req.query.email;
      const userDoc = await usersCollection.findOne({ email });

      if (!userDoc) {
        return res.status(404).send({ message: "User not found" });
      }

      const { phoneNumber, address } = userDoc;
      res.send({ phoneNumber, address });
    });

    // update current user info
    app.patch("/update-user-info", async (req, res) => {
      const { email, phoneNumber, address } = req.body;
      const userDoc = await usersCollection.findOne({ email });

      if (!userDoc) {
        return res.status(404).send({ message: "User not found" });
      }
      const samePhone = userDoc.phoneNumber === phoneNumber;
      const sameAddress = userDoc.address === address;
      if (samePhone && sameAddress) {
        return res.status(400).send({ message: "No changes detected" });
      }

      const result = await usersCollection.updateOne(
        { email },
        {
          $set: { phoneNumber, address },
        }
      );
      res.send(result);
    });

    // load user cart-items with details
    app.get("/user-cart-items", async (req, res) => {
      const email = req.query.email;
      const userDoc = await usersCollection.findOne({ email });
      const productIds =
        userDoc.cartItems.map((p) => new ObjectId(p.productId)) || [];
      const productQuantity = new Map(
        userDoc.cartItems.map((item) => [item.productId, item.quantity])
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
      const product = await productsCollection.findOne({
        _id: new ObjectId(productId),
      });

      if (product.inStock === false) {
        return res.send({ error: "Out of stock" });
      }

      const result = await usersCollection.updateOne(
        { email },
        { $push: { cartItems: { productId, quantity } } }
      );
      res.send(result);
    });

    // update cart product quantity
    app.patch("/update-cart-quantity", async (req, res) => {
      const { email, productId, quantity } = req.body;

      const result = await usersCollection.updateOne(
        { email, "cartItems.productId": productId },
        { $set: { "cartItems.$.quantity": quantity } }
      );
      res.send(result);
    });

    // delete product from cartlist
    app.patch("/delete-cart-product", async (req, res) => {
      const { email, productId } = req.body;

      const result = await usersCollection.updateOne(
        { email },
        { $pull: { cartItems: { productId } } }
      );
      res.send(result);
    });

    // Place an Order
    app.post("/place-order", async (req, res) => {
      const { email, phoneNumber, address, paymentMethod, totalPrice } =
        req.body;

      try {
        const userDoc = await usersCollection.findOne({ email });
        // if (!userDoc || !userDoc.cartItems || userDoc.cartItems.length === 0) {
        //   return res.send({ success: false, message: "Cart is empty" });
        // }
        const cartItems = userDoc.cartItems;
        const order = {
          orderId: new Date().getTime().toString(),
          items: cartItems,
          totalPrice,
          orderDate: new Date(),
          status: "pending",
          paymentMethod,
          shippingAddress: address,
          phoneNumber,
          userEmail: email,
        };

        const result = await usersCollection.updateOne(
          { email },
          {
            $push: { orders: order },
            $set: { cartItems: [] },
          }
        );
        res.send({ success: true, result });
      } catch (error) {
        console.error("Order error:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // load user orders
    app.get("/user-orders", async (req, res) => {
      const email = req.query.email;
      const userDoc = await usersCollection.findOne({ email });
      const { orders } = userDoc;
      const ordersWithProdDetails = [];

      for (const order of orders) {
        const enrichedItems = await Promise.all(
          order.items.map(async (item) => {
            const product = await productsCollection.findOne({
              _id: new ObjectId(item.productId),
            });

            return {
              product,
              quantity: item.quantity,
            };
          })
        );
        ordersWithProdDetails.push({
          ...order,
          items: enrichedItems,
        });
      }

      res.send(ordersWithProdDetails);
    });

    // ------------- ADMIN APIS -------------------

    // Add a new product
    app.post("/add-product", async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });

    // change stock status
    app.patch("/change-stock", async (req, res) => {
      const { productId, inStock } = req.body;
      const filter = { _id: new ObjectId(productId) };
      const updateDoc = { $set: { inStock } };

      const result = await productsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // load all orders
    app.get("/all-orders", async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      const allOrders = [];

      for (const user of users) {
        const userOrders = user.orders || [];

        for (const order of userOrders) {
          const enrichedItems = await Promise.all(
            order.items.map(async (item) => {
              const product = await productsCollection.findOne({
                _id: new ObjectId(item.productId),
              });

              return {
                productName: product?.name,
                productId: item.productId,
                quantity: item.quantity,
              };
            })
          );

          allOrders.push({
            ...order,
            items: enrichedItems,
          });
        }
      }

      res.send(allOrders);
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
