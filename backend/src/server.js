import "dotenv/config"
import express from "express"
import cors from "cors"
import orgauthroutes from "./controllers/organizationAuth.js"
import empauthroutes from "./controllers/employeeAuth.js"
import customerroutes from "./controllers/customerAuth.js"


const app = express()
app.use(cors())
app.use(express.json())

app.use("/org", orgauthroutes)
app.use("/emp", empauthroutes)
app.use("/cust", customerroutes)

const PORT = process.env.PORT
app.listen(PORT, () => {
    console.log("server started")
})