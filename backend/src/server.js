import "dotenv/config"
import express from "express"
import cors from "cors"
import login from "./controllers/authLogin.js"
import orgauthroutes from "./controllers/organizationAuth.js"
import empauthroutes from "./controllers/employeeAuth.js"
import customerroutes from "./controllers/customerAuth.js"
import allroute from "./controllers/generalAuth.js"
import projectRoute from "./controllers/projectsControler.js"
import taskRoute from "./controllers/taskControler.js"


const app = express()
app.use(cors())
app.use(express.json())

app.use(allroute)
app.use(login)
app.use("/project", projectRoute)
app.use("/task", taskRoute)
app.use("/organization", orgauthroutes)
app.use("/employee", empauthroutes)
app.use("/customer", customerroutes)

const PORT = process.env.PORT
app.listen(PORT, () => {
    console.log("server started")
})