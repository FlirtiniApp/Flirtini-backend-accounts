const express = require('express');
const session = require('express-session');
const cors = require('cors');
const request = require('request');
const app = express();
const port = 3000;
const month = 2628000000; // 30 days in milliseconds

app.use(cors())
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

// Users array, will be populated before server starts
let users = [];

// THE DB IT GIVES NAMES FOR FREE++
function getUsers() {
    request.get('http://172.24.3.84:3000/users/all', (error, response, body) => {
    if (!error && response.statusCode === 200) {
        users = JSON.parse(body);
    } else {
        console.error('Error:', error || body);
    }
    });
}

// LOGIN
accountRouter.post('/login', (req, res) => {
    getUsers();
    const { login, password } = req.body;
    const user = users.find(u => u.login === login && u.password === password);
    if (user) {
        req.session.logged = true;
        req.session.login = login;
        req.session.cookie.expires = new Date(Date.now() + month);
        req.session.save();
        res.send("LOGIN SUCCESS");
    } else {
        res.status(401).send("UNAUTHORIZED");
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
    const {name, surname, login, password, birtDate, email, phone } = req.body;
    if (!login || !password || !email) {
        return res.status(400).send("Login, password and email required");
    }
    if (users.find(u => u.login === login)) {
        return res.status(409).send("Login already exists");
    }
    if (users.find(u => u.email === email)) {
        return res.status(409).send("Email already exists");
    }
    const newUser = {
        name: name,
        surname: surname,
        login: login,
        password: password,
        birtDate: birtDate,
        email: email,
        phoneNumber: phone || ''
    };
    request.post({
        url: 'http://172.24.3.84:3000/users',
        json: newUser,
    }, (error, response, body) => {
        if (!error && response.statusCode === 201) {
            console.log('Created:', body);
        } else {
            console.error('Error:', error || body);
        }
    });
    getUsers();
    req.session.logged = true;
    req.session.login = login;
    req.session.cookie.expires = new Date(Date.now() + month);
    req.session.save();
    res.status(201).send("REGISTER SUCCESS");
});

// UPDATE USER
accountRouter.post('/update', (req, res) => {
    const { login, password, email } = req.body;
    if (!req.session.logged) {
        return res.status(401).send("Unauthorized");
    }
    const updatedUser = {
        login: login || req.session.login,
        password: password || users.find(u => u.login === req.session.login).password,
        email: email || users.find(u => u.login === req.session.login).email
    };

    request.put({
        url: 'http://172.24.3.84:3000/users/' + users.find(u => u.login === req.session.login)._id,
        json: updatedUser
    }, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            console.log('Updated:', body);
        } else {
            console.error('Error:', error || body);
        }
    });
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
