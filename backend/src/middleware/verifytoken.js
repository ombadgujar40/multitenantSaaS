import jwt from "jsonwebtoken"

export const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Access denied, no token provided" });
    }

    const token = authHeader.split(" ")[1]
    try {
        const tkData = jwt.verify(token, process.env.JWT_SECRET)
        req.user = tkData
        next()
    } catch (error) {
        console.log(error)
    }
   
}