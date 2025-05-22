// Load environment variables
require('dotenv').config();

const express = require("express");
const app = express();
const http = require("http").createServer(app); // Create HTTP server
const io = require('socket.io')(http); // Initialize Socket.io with the HTTP server
const bodyParser = require('body-parser');
const path = require("path");
const session = require('express-session');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const { isAdmin } = require('./middleware/auth');
const Message = require('./models/Message');

// Import models
const User = require('./models/User');
const Club = require('./models/Club');
const Application = require('./models/Application');

// Vercel serverless configuration
const isVercel = process.env.VERCEL;
const FUNCTION_TIMEOUT = 9000; // 9 seconds (Vercel's limit is 10s)
const MAX_MEMORY_USAGE = 900; // MB (Vercel's limit is 1024MB)

// Memory monitoring
function checkMemoryUsage() {
    const used = process.memoryUsage();
    const memoryUsageMB = Math.round(used.heapUsed / 1024 / 1024);
    
    if (memoryUsageMB > MAX_MEMORY_USAGE) {
        console.error(`Memory usage exceeded: ${memoryUsageMB}MB`);
        return false;
    }
    return true;
}

// MongoDB connection with Vercel optimization
let mongooseConnection = null;

async function connectDB() {
    try {
        if (mongooseConnection) {
            return mongooseConnection;
        }

        mongooseConnection = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: isVercel ? 1 : 10,
            minPoolSize: 0,
            maxIdleTimeMS: 10000
        });

        console.log('Connected to MongoDB');
        return mongooseConnection;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

// Initialize database connection
connectDB().catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
});

// Vercel-specific middleware
app.use((req, res, next) => {
    // Check memory usage
    if (!checkMemoryUsage()) {
        return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Server is under heavy load'
        });
    }

    // Set timeout for Vercel
    if (isVercel) {
        req.setTimeout(FUNCTION_TIMEOUT);
    }

    next();
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "cdnjs.cloudflare.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true
}));

// CORS configuration for Vercel
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? [process.env.CORS_ORIGIN_PRODUCTION] 
        : [process.env.CORS_ORIGIN_DEVELOPMENT],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400
}));

// Session configuration with Vercel optimization
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
    },
    name: 'sessionId',
    rolling: true,
    unset: 'destroy'
}));

// Body parsing middleware
app.use(express.json({ limit: '1mb' })); 
app.use(express.urlencoded({ extended: true, limit: '1mb' })); 
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use('/images', express.static(path.join(__dirname, "public/images")));

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

// Socket.io Communication with environment variables
io.on("connection", (socket) => {
    console.log("New user connected");

    // Set timeout for Vercel
    if (isVercel) {
        socket.setTimeout(FUNCTION_TIMEOUT);
    }

    // Error handler for socket
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        socket.emit('error', { 
            message: 'An error occurred',
            type: error.name
        });
    });

    // Join a chat room
    socket.on('joinRoom', async (room) => {
        try {
            if (!room) {
                throw new Error('Room name is required');
            }
            socket.join(room);
            console.log(`User joined room: ${room}`);
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // Handle new messages
    socket.on('chatMessage', async (data) => {
        try {
            if (!data || !data.message || !data.room || !data.sender) {
                throw new Error('Invalid message data');
            }
            
            const { message, room, sender } = data;
            
            // Validate message length
            if (message.length > 1000) {
                throw new Error('Message too long');
            }

            // Save message to database
            const newMessage = new Message({
                sender: sender,
                content: message,
                chatRoom: room
            });
            
            await newMessage.save();

            // Broadcast message to room
            io.to(room).emit('message', {
                content: message,
                sender: sender,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error handling message:', error);
            socket.emit('error', { 
                message: error.message || 'Failed to send message',
                type: error.name
            });
        }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        try {
            console.log("User disconnected");
            socket.removeAllListeners();
        } catch (error) {
            console.error('Error during disconnect:', error);
        }
    });
});

// Routes
app.get('/signin', (req, res) => {
    res.render('signin', { error: null });
});

app.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    
    // Check for admin credentials using environment variables
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        req.session.user = {
            name: 'Admin User',
            email: process.env.ADMIN_EMAIL,
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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);

    // Handle specific errors
    if (err.name === 'TimeoutError') {
        return res.status(504).json({
            error: 'Gateway Timeout',
            message: 'The request took too long to process'
        });
    }

    if (err.name === 'MongooseError') {
        return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Database connection error'
        });
    }

    // Default error response
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    if (isVercel) {
        process.exit(1);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (isVercel) {
        process.exit(1);
    }
});

// Handle Vercel function termination
if (isVercel) {
    process.on('SIGTERM', async () => {
        console.log('SIGTERM received. Cleaning up...');
        try {
            if (mongooseConnection) {
                await mongooseConnection.close();
                console.log('Database connection closed');
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
        process.exit(0);
    });
}

// Export for Vercel
if (isVercel) {
    module.exports = app;
} else {
    // Regular server startup
    const PORT = process.env.PORT || 3000;
    http.listen(PORT, () => {
        console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
}

// const port = 8080;
// app.listen(port, (req, res) => {
//     console.log("server working");
// })
