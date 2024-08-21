const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 4549;
const mongoURI = process.env.MONGO_URI;
const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://gadget-world-client.vercel.app",
    ],
  })
);
app.use(express.json())

const client = new MongoClient(mongoURI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const run = async () => {
  try {
    await client.connect();
    const productsCollection = client.db("gadget-world").collection("products");

    // Route to fetch products with filters, sorting, and pagination
    app.get("/products", async (req, res) => {
        try {
            const {
                search,
                category,
                brand,
                minPrice,
                maxPrice,
                sortBy,
                page = 1,
                limit = 10,
            } = req.query;
    
            // Convert minPrice and maxPrice to numbers for comparison
            const minPriceNum = minPrice ? parseFloat(minPrice) : undefined;
            const maxPriceNum = maxPrice ? parseFloat(maxPrice) : undefined;
    
            // Build the query object
            const query = {};
    
            if (search) {
                query.name = { $regex: search, $options: "i" }; // Case-insensitive search
            }
    
            if (category) {
                query.category = category;
            }
    
            if (brand) {
                query.brand = brand;
            }
    
            // Build the sort options
            const sortOptions = {};
            if (sortBy) {
                const [field, order] = sortBy.split("-");
                sortOptions[field] = order === "desc" ? -1 : 1;
            }
    
            // Handle pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);
    
            // Fetch data from the database
            const products = await productsCollection
                .find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .toArray();
    
            // Filter products based on minPrice and maxPrice after fetching
            const filteredProducts = products.filter(product => {
                const priceNum = parseFloat(product.price); // Convert price string to number
                let inRange = true;
    
                if (!isNaN(minPriceNum)) {
                    inRange = inRange && priceNum >= minPriceNum;
                }
    
                if (!isNaN(maxPriceNum)) {
                    inRange = inRange && priceNum <= maxPriceNum;
                }
    
                return inRange;
            });

                // Count all products (unfiltered) for pagination
    const totalProducts = await productsCollection.countDocuments({});

    // Count filtered products
    const totalFilteredProducts = await productsCollection.countDocuments(query);
    
            // Respond with filtered products and total count
            res.json({
                data: filteredProducts,
                total: totalProducts,
                totalFilteredProducts: totalFilteredProducts
            });
        } catch (error) {
            console.error("Error fetching products:", error);
            res.status(500).json({ error: "Internal Server Error", details: error.message });
        }
    });
    
    
    app.get("/brands", async (req, res) => {
        try {
          // Aggregate unique brands from the products collection
          const brands = await productsCollection.aggregate([
            { $group: { _id: "$brand" } }, // Group by brand
            { $project: { _id: 0, brand: "$_id" } } // Format the output
          ]).toArray();
  
          // Respond with the list of unique brands
          res.json(brands.map(b => b.brand));
        } catch (error) {
          console.error("Error fetching brands:", error);
          res.status(500).json({ error: "Internal Server Error" });
        }
      });

      app.get("/categories", async (req, res) => {
        try {
          // Aggregate unique categories from the products collection
          const categories = await productsCollection.aggregate([
            { $group: { _id: "$category" } }, // Group by category
            { $project: { _id: 0, category: "$_id" } } // Format the output
          ]).toArray();
  
          // Respond with the list of unique categories
          res.json(categories.map(c => c.category));
        } catch (error) {
          console.error("Error fetching categories:", error);
          res.status(500).json({ error: "Internal Server Error" });
        }
      });
  

    // Start the server
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
};

// Run the function
run();
