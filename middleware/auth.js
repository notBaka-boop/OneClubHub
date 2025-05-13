const isAdmin = (req, res, next) => {
    // Check if user is logged in and is admin
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.redirect('/signin');
    }
};

module.exports = { isAdmin }; 