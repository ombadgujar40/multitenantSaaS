import "dotenv/config"
import express from "express"
import cors from "cors"
import authroutes from "./controllers/authcontroller.js"


const app = express()
app.use(cors())
app.use(express.json())

app.use("/auth", authroutes)

const PORT = process.env.PORT
app.listen(PORT, () => {
    console.log("server started")
})