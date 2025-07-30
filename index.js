const express = require('express');
const session = require('express-session');
const app = express();
const port = 3000;
const month = 2628000000; // 30 days in milliseconds

app.use(express.json());

//Start session middleware
app.use(session({
    secret: 'engineer',
    resave: false,
    saveUninitialized: false,
    logged: false,
    login: ''
}));

// ACCOUNT ROUTER
const accountRouter = express.Router();
app.use('/account', accountRouter);

// Dummy users array for demonstration (should be replaced with DB in production)
const users = [
    { id: 1, username: 'alice', password: 'pass1' },
    { id: 2, username: 'bob', password: 'pass2' }
];

// LOGIN
accountRouter.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        req.session.logged = true;
        req.session.login = username;
        req.session.cookie.expires = new Date(Date.now() + month);
        req.session.save();
        res.send("LOGIN SUCCESS");
    } else {
        res.status(401).send("INVALID CREDENTIALS");
    }
});

// LOGOUT
accountRouter.post('/logout', (req, res) => {
    req.session.logged = false;
    req.session.login = ''; 
    req.session.save();
    res.redirect('/account/login');
});

// REGISTER NEW USER
accountRouter.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send("Username and password required");
    }
    if (users.find(u => u.username === username)) {
        return res.status(409).send("Username already exists");
    }
    const newUser = { id: users.length + 1, username, password };
    users.push(newUser);
    req.session.logged = true;
    req.session.login = username;
    req.session.cookie.expires = new Date(Date.now() + month);
    req.session.save();
    res.status(201).send("REGISTER SUCCESS");
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
})