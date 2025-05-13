const mongoose = require('mongoose');
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

// Sample data
const users = [
    {
        name: 'Rahul Kumar',
        email: 'rahul.kumar@gmail.com',
        enrollment: 'F24CE005',
        branch: 'Computer Engineering',
        status: 'active'
    },
    {
        name: 'Ayush Gade',
        email: 'ayushgade23@gmail.com',
        enrollment: 'F24IT107',
        branch: 'Information Technology',
        status: 'active'
    },
    {
        name: 'John Doe',
        email: 'john.doe@gmail.com',
        enrollment: 'F24CE123',
        branch: 'Computer Engineering',
        status: 'active'
    },
    {
        name: 'Jane Smith',
        email: 'jane.smith@gmail.com',
        enrollment: 'F24IT456',
        branch: 'Information Technology',
        status: 'active'
    }
];

const clubs = [
    {
        name: 'PICT CSI',
        description: 'Computer Society of India - PICT Student Chapter',
        events: [
            {
                title: 'Hackathon 2024',
                date: new Date('2024-04-15'),
                description: 'Annual coding competition'
            },
            {
                title: 'Tech Workshop',
                date: new Date('2024-03-20'),
                description: 'Web development workshop'
            }
        ]
    },
    {
        name: 'PICT ACM',
        description: 'Association for Computing Machinery - PICT Student Chapter',
        events: [
            {
                title: 'Code Sprint',
                date: new Date('2024-04-01'),
                description: 'Competitive programming event'
            },
            {
                title: 'AI Workshop',
                date: new Date('2024-03-25'),
                description: 'Introduction to Machine Learning'
            }
        ]
    }
];

// Function to seed the database
async function seedDatabase() {
    try {
        // Clear existing data
        await User.deleteMany({});
        await Club.deleteMany({});
        await Application.deleteMany({});

        // Insert users
        const createdUsers = await User.insertMany(users);
        console.log('Users created successfully');

        // Insert clubs
        const createdClubs = await Club.insertMany(clubs);
        console.log('Clubs created successfully');

        // Create applications
        const applications = [
            {
                club: createdClubs[0]._id,
                applicant: createdUsers[2]._id,
                reason: 'I am passionate about technology and want to contribute to the tech community.',
                experience: 'Participated in hackathons and coding competitions.',
                status: 'pending'
            },
            {
                club: createdClubs[1]._id,
                applicant: createdUsers[3]._id,
                reason: 'Interested in learning about new technologies and networking with peers.',
                experience: 'Web development projects and technical workshops.',
                status: 'approved'
            }
        ];

        await Application.insertMany(applications);
        console.log('Applications created successfully');

        console.log('Database seeded successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

// Run the seed function
seedDatabase(); 