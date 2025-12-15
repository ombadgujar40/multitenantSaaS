

export const requirePlatformAdmin = (req, res, next) => {  
    if(!req.user) {
        return res.status(401).send("Invalid")
    }else if(req.user.role != "superAdmin") {
        return res.status(403).send("Unauthorized")
    }else {
        next();
    }
}