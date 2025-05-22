// Load environment variables
require('dotenv').config();

const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require('socket.io')(http);
const bodyParser = require('body-parser');
const path = require("path");
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const { isAdmin } = require('./middleware/auth');

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
    }
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
    secret: process.env.SESSION_SECRET || 'your-secret-key',
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

// Static files
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use('/images', express.static(path.join(__dirname, "public/images")));

// Mock data for frontend
const users = [
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

const clubs = [
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

const applications = [
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

// In-memory message storage
const messages = new Map();

// Socket.IO with Vercel optimization
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
    socket.on('joinRoom', (room) => {
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
    socket.on('chatMessage', (data) => {
        try {
            if (!data || !data.message || !data.room || !data.sender) {
                throw new Error('Invalid message data');
            }
            
            const { message, room, sender } = data;
            
            // Validate message length
            if (message.length > 1000) {
                throw new Error('Message too long');
            }

            // Store message in memory
            if (!messages.has(room)) {
                messages.set(room, []);
            }
            const roomMessages = messages.get(room);
            const newMessage = {
                content: message,
                sender: sender,
                timestamp: new Date()
            };
            roomMessages.push(newMessage);

            // Broadcast message to room
            io.to(room).emit('message', newMessage);
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
    res.render("clubs.ejs", { user: req.session.user, clubs: clubs });
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

app.get("/chat", (req, res) => {
    if (!req.session.user) {
        return res.redirect('/signin');
    }
    res.render("chat", { user: req.session.user });
});

// Signin route
app.post('/signin', (req, res) => {
    const { email, password } = req.body;
    
    // Check for admin credentials
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

// Get chat history
app.get('/api/messages/:room', (req, res) => {
    try {
        const roomMessages = messages.get(req.params.room) || [];
        res.json(roomMessages);
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
