const express = require("express");
const app = express();
const http = require("http").createServer(app); // Create HTTP server
const io = require('socket.io')(http); // Initialize Socket.io with the HTTP server
const bodyParser = require('body-parser');
const path = require("path");
const session = require('express-session');
const mongoose = require('mongoose');
const { isAdmin } = require('./middleware/auth');
const Message = require('./models/Message');

// Import models
const User = require('./models/User');
const Club = require('./models/Club');
const Application = require('./models/Application');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/onclubhub', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Session configuration
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // set to true if using https
}));

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

// Mock database (replace with actual database in production)
let users = [
    {
        id: 1,
        name: 'Rahul Kumar',
        email: 'rahul.kumar@gmail.com',
        enrollment: 'F24CE005',
        branch: 'Computer Engineering',
        status: 'active',
        password: 'rahul123'
    },
    {
        id: 2,
        name: 'Ayush Gade',
        email: 'ayushgade23@gmail.com',
        enrollment: 'F24IT107',
        branch: 'Information Technology',
        status: 'active'
    }
];

let clubs = [
    {
        id: 1,
        name: 'PICT CSI',
        description: 'Computer Society of India - PICT Student Chapter',
        members: 45,
        events: 12,
        applications: 8
    },
    {
        id: 2,
        name: 'PICT ACM',
        description: 'Association for Computing Machinery - PICT Student Chapter',
        members: 38,
        events: 9,
        applications: 5
    }
];

let applications = [
    {
        id: 1,
        clubId: 1,
        applicantName: 'John Doe',
        enrollment: 'F24CE123',
        branch: 'Computer Engineering',
        reason: 'I am passionate about technology and want to contribute to the tech community.',
        experience: 'Participated in hackathons and coding competitions.',
        status: 'pending'
    },
    {
        id: 2,
        clubId: 2,
        applicantName: 'Jane Smith',
        enrollment: 'F24IT456',
        branch: 'Information Technology',
        reason: 'Interested in learning about new technologies and networking with peers.',
        experience: 'Web development projects and technical workshops.',
        status: 'approved'
    }
];

app.get("/", (req, res) => {
    if (req.session.user) {
        res.redirect("/clubs");
    } else {
        res.render("index.ejs", { user: req.session.user });
    }
});

app.get("/home", (req, res) => {
    if (req.session.user) {
        res.redirect("/clubs");
    } else {
        res.render("index.ejs", { user: req.session.user });
    }
});

app.get("/clubs", (req, res) => {
    res.render("clubs.ejs", { user: req.session.user });
});

app.get("/csi", (req, res) => {
    res.render("csi.ejs", { user: req.session.user });
});

app.get("/pictcsi", (req, res) => {
    res.render("csi.ejs", { user: req.session.user });
});

app.get("/acm", (req, res) => {
    res.render("acm.ejs", { user: req.session.user });
});

app.get("/myclub", (req, res) => {
    res.render("myclub.ejs", { user: req.session.user });
});

app.get("/pictcsi/join", (req, res) => {
    res.render("join.ejs", { user: req.session.user });
});

app.get("/myprofile", (req, res) => {
    res.render("myprofile.ejs", { user: req.session.user });
});

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/');
    });
});

app.get("/signin", (req, res) => {
    res.render("signin", { error: null });
});

app.get("/notification", (req, res) => {
    res.render("notification.ejs", { user: req.session.user });
});

// Route for Chat Page
app.get("/chat", (req, res) => {
    if (!req.session.user) {
        return res.redirect('/signin');
    }
    res.render("chat", { user: req.session.user });
});

// Socket.io Communication
io.on("connection", (socket) => {
    console.log("New user connected");

    // Join a chat room
    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`User joined room: ${room}`);
    });

    // Handle new messages
    socket.on('chatMessage', async (data) => {
        try {
            console.log('Received message:', data); // Debug log
            
            const { message, room, sender } = data;
            
            // Save message to database
            const newMessage = new Message({
                sender: sender,
                content: message,
                chatRoom: room
            });
            
            await newMessage.save();
            console.log('Message saved to database:', newMessage); // Debug log

            // Broadcast message to room
            io.to(room).emit('message', {
                content: message,
                sender: sender,
                timestamp: new Date()
            });
            
            console.log('Message broadcasted to room:', room); // Debug log
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

// Routes
app.get('/signin', (req, res) => {
    res.render('signin', { error: null });
});

app.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    
    // Check for admin credentials
    if (email === 'admin@gmail.com' && password === 'admin123') {
        req.session.isAdmin = true;
        req.session.user = {
            name: 'Admin User',
            email: 'admin@gmail.com',
            isAdmin: true
        };
        return res.redirect('/admin/dashboard');
    }
    
    // Regular user authentication using mock data
    const user = users.find(u => u.email === email);
    
    if (!user) {
        return res.render('signin', { error: 'Invalid email or password' });
    }

    if (user.password === password) {
        req.session.user = {
            name: user.name,
            email: user.email,
            isAdmin: false
        };
        return res.redirect('/clubs');
    }

    return res.render('signin', { error: 'Invalid email or password' });
});

// Admin routes with authentication
app.get('/admin/dashboard', isAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeClubs = await Club.countDocuments();
        const pendingApplications = await Application.countDocuments({ status: 'pending' });

        res.render('admin-dashboard', {
            stats: {
                totalUsers,
                activeClubs,
                pendingApplications
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Server error');
    }
});

app.get('/admin/users', isAdmin, async (req, res) => {
    try {
        const users = await User.find();
        res.render('admin-users', { users });
    } catch (error) {
        console.error('Users error:', error);
        res.status(500).send('Server error');
    }
});

app.get('/admin/clubs', isAdmin, async (req, res) => {
    try {
        const clubs = await Club.find().populate('members');
        res.render('admin-clubs', { clubs });
    } catch (error) {
        console.error('Clubs error:', error);
        res.status(500).send('Server error');
    }
});

app.get('/admin/applications', isAdmin, async (req, res) => {
    try {
        const applications = await Application.find()
            .populate('club')
            .populate('applicant');
        res.render('admin-applications', { applications });
    } catch (error) {
        console.error('Applications error:', error);
        res.status(500).send('Server error');
    }
});

// API routes for admin actions
app.post('/api/users/:id/delete', isAdmin, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/users/:id/edit', isAdmin, async (req, res) => {
    try {
        const { name, email, enrollment, branch } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, enrollment, branch },
            { new: true }
        );
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/clubs/:id/delete', isAdmin, async (req, res) => {
    try {
        await Club.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/clubs/:id/edit', isAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;
        const club = await Club.findByIdAndUpdate(
            req.params.id,
            { name, description },
            { new: true }
        );
        res.json({ success: true, club });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/applications/:id/approve', isAdmin, async (req, res) => {
    try {
        const application = await Application.findByIdAndUpdate(
            req.params.id,
            { status: 'approved' },
            { new: true }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/applications/:id/reject', isAdmin, async (req, res) => {
    try {
        const application = await Application.findByIdAndUpdate(
            req.params.id,
            { status: 'rejected' },
            { new: true }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
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

// API routes for admin actions
app.post('/api/users/add', isAdmin, async (req, res) => {
    try {
        const { name, email, enrollment, branch } = req.body;

        // Check if user with same email or enrollment already exists
        const existingUser = await User.findOne({
            $or: [
                { email: email },
                { enrollment: enrollment }
            ]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User with this email or enrollment number already exists'
            });
        }

        // Create new user
        const user = new User({
            name,
            email,
            enrollment,
            branch,
            status: 'active'
        });

        await user.save();
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get chat history
app.get('/api/messages/:room', async (req, res) => {
    try {
        const messages = await Message.find({ chatRoom: req.params.room })
            .populate('sender', 'name')
            .sort({ timestamp: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching messages' });
    }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// const port = 8080;
// app.listen(port, (req, res) => {
//     console.log("server working");
// })
