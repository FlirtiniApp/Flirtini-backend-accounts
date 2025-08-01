const express = require('express');
const session = require('express-session');
const cors = require('cors');
const request = require('request');
const { body, validationResult } = require('express-validator');
const app = express();
const port = 3000;
const month = 2628000000; // 30 days in milliseconds

app.use(express.json());

const allowedOrigins = ['http://localhost:5173', 'http://172.24.3.4:5173'];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

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
    res.status(200).send("LOGOUT SUCCESS");

});

// REGISTER NEW USER
accountRouter.post('/register', [

    // VALIDATION RULES
    body('firstname')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 30 }).withMessage('Name must be 2-30 characters'),
    
    body('lastname')
        .trim() 
        .notEmpty().withMessage('Surname is required')
        .isLength({ min: 2, max: 30 }).withMessage('Surname must be 2-30 characters'),

    body('login')
        .trim()
        .notEmpty().withMessage('Login is required')
        .isLength({ min: 4, max: 20 }).withMessage('Login must be 4-20 characters'),

    body('password')
        .trim()
        .notEmpty().withMessage('Password is required')
        .isStrongPassword({ minLength: 6})
        .withMessage('Password must be at least 6 characters'),
    
    body('birthday')
        .trim()
        .custom(value => {
            const birthDate = new Date(value);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            if (age < 18) {
                throw new Error('You must be at least 18 years old');
            }
            return true;
        })
        //.isISO8601().withMessage('Invalid date format, use YYYY-MM-DD')
        .notEmpty().withMessage('Birth date is required'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format'),

    body('phone')
        .optional()
        .matches(/^\+?[0-9\s\-]{7,15}$/).withMessage('Invalid phone number')



], (req, res) => {
    const { firstname, lastname, login, password, birthday, email, phone } = req.body;

    if (!login || !password || !email) {
        return res.status(400).send("Login, password and email are required");
    }

    const existingLogin = users.find(u => u.login === login);
    const existingEmail = users.find(u => u.email === email);

    if (existingLogin) return res.status(409).send("Login already exists");
    if (existingEmail) return res.status(409).send("Email already exists");

    const newUser = {
        firstname: firstname,
        lastname: lastname,
        login: login,
        password: password,
        birthday: birthday,
        email: email,
        phoneNumber: phone || ''
    };

    request.post({
        url: 'http://172.24.3.84:3000/users',
        json: newUser,
    }, (error, response, body) => {
    if (!error && response.statusCode === 201) {
        getUsers();

        req.session.logged = true;
        req.session.login = login;
        req.session.cookie.expires = new Date(Date.now() + month);
        req.session.save();

        return res.status(201).send("REGISTER SUCCESS");
    } else {
        console.error('Register failed:', error || body);
      return res.status(500).send("Failed to create user");
    }
  });
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
