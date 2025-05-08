const express = require("express");
const app = express();
const http = require("http").createServer(app); // Create HTTP server
const { Server } = require("socket.io");
const io = new Server(http); // Initialize Socket.io with the HTTP server
const bodyParser = require('body-parser');
const path = require("path");

app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(bodyParser.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "images")));

// At the top of your app.js file
let userData = {
    name: 'Rahul Kumar',
    address: '12, Surrey Street, Pune, Maharashtra',
    email: 'rahul.kumar@gmail.com',
    phone: '+91 7811265890',
    division: 'FY-2',
    branch: 'Computer Engineering',
    enrollment: 'F24CE005'
};



app.get("/home", (req, res) => {
    res.render("index.ejs");
})

app.get("/pictcsi", (req, res) => {
    res.render("csi.ejs");
})

app.get("/myclub", (req, res) => {
    res.render("myclub.ejs");
})

app.get("/pictcsi/join", (req, res) => {
    res.render("join.ejs");
})

app.get("/myprofile", (req, res) => {
    res.render("myprofile.ejs", {user: userData});
})

app.get("/logout", (req, res) => {
    res.render("logout.ejs");
})

app.get("/signin", (req, res) => {
    res.render("signin");
});

app.get("/notification", (req, res) => {
    res.render("notification.ejs");
})

// Route for Chat Page
app.get("/chat", (req, res) => {
    res.render("chat");
});

// Socket.io Communication
io.on("connection", (socket) => {
    console.log("New user connected");

    socket.on("chat message", (msg) => {
        io.emit("chat message", msg);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

// Routes
app.get('/signin', (req, res) => {
    res.render('signin');
});

app.post('/signin', (req, res) => {
    const { username, password } = req.body;
    console.log(`Username: ${username}, Password: ${password}`);
    res.redirect('/home');
});

app.get('/editprofile', (req, res) => {
    const userData = {
        name: 'Ayush Gade',
        enrollment: 'F24IT107',
        address: '12, Surrey Street, Pune, Maharashtra',
        email: 'ayushgade23@gmail.com',
        division: 'FY-2',
        branch: 'Information Technology',
        phone: '+91 9527625400'
    };
    res.render('editprofile', { user: userData });
});

// Route to Update Profile
app.post('/updateprofile', (req, res) => {
    const { name, address, email, phone, division, branch, enrollment } = req.body;
    userData.name = name;
    userData.address = address;
    userData.email = email;
    userData.phone = phone;
    userData.division = division;
    userData.branch = branch;
    userData.enrollment = enrollment
    res.redirect('/myprofile');
});

app.get('/apply', (req, res) => {
    res.render('join.ejs'); // Make sure 'clubApplication.ejs' is the file for this form
});




const PORT = process.env.PORT || 8000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// const port = 8080;
// app.listen(port, (req, res) => {
//     console.log("server working");
// })
