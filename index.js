const express = require('express');
const cors = require('cors');
const request = require('request');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const app = express();
const port = 3000;
const JWT_SECRET = 'engineer';

app.use(express.json());

const allowedOrigins = [
  'http://192.168.1.105:5173',
  'http://localhost:5173',
  'http://172.24.3.4:5173',
  'http://172.24.3.60:5173'
];

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

// ACCOUNT ROUTER
const accountRouter = express.Router();
app.use('/account', accountRouter);

let users = [];

// THE DB IT GIVES THE NAMES FOR FREE++
function getUsersAsync() {
  return new Promise((resolve, reject) => {
    request.get('http://192.168.1.102:3000/users/all', (error, response, body) => {
      if (!error && response.statusCode === 200) {
        users = JSON.parse(body);
        resolve(users);
      } else {
        reject(error || body);
      }
    });
  });
}

// VERIFY JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) return res.status(401).send('Unauthorized');

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send('Invalid token');
    req.user = user;
    next();
  });
}

// LOGIN
accountRouter.post('/login', async (req, res) => {
  try {
    await getUsersAsync();
    const { login, password } = req.body;
    const user = users.find(u => u.login === login && u.password === password);

    if (user) {
      const token = jwt.sign(
        { login: user.login, logged: true },
        JWT_SECRET,
        { expiresIn: '30d' }
      );
      return res.status(200).json({ token });
    } else {
      return res.status(401).send("Invalid credentials");
    }
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).send("Server error during login");
  }
});

// LOGOUT
accountRouter.post('/logout', (req, res) => {
  // Just tell the client to delete the token.
  return res.status(200).send("LOGOUT SUCCESS");
});

// REGISTER
accountRouter.post('/register', [

  body('firstname').trim().notEmpty().isLength({ min: 2, max: 30 }),
  body('lastname').trim().notEmpty().isLength({ min: 2, max: 30 }),
  body('login').trim().notEmpty().isLength({ min: 4, max: 20 }),
  body('password').trim().notEmpty().isStrongPassword({ minLength: 6 }),
  body('birthday').trim().notEmpty().custom(value => {
    const birthDate = new Date(value);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    if (age < 18) throw new Error('You must be at least 18 years old');
    return true;
  }),
  body('email').trim().notEmpty().isEmail(),
  body('phone').optional().matches(/^\+?[0-9\s\-]{7,15}$/)

], async (req, res) => {
  const { firstname, lastname, login, password, birthday, email, phone } = req.body;

  await getUsersAsync();
  const existingLogin = users.find(u => u.login === login);
  const existingEmail = users.find(u => u.email === email);

  if (existingLogin) return res.status(409).send("Login already exists");
  if (existingEmail) return res.status(409).send("Email already exists");

  const newUser = {
    firstname, lastname, login, password,
    birthday, email, phoneNumber: phone || ''
  };

  request.post({
    url: 'http://192.168.1.102:3000/users',
    json: newUser,
  }, async (error, response, body) => {
    if (!error && response.statusCode === 201) {
      await getUsersAsync();

      const token = jwt.sign(
        { login, logged: true },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.status(201).json({ token });
    } else {
      console.error('Register failed:', error || body);
      return res.status(500).send("Failed to create user");
    }
  });
});

// UPDATE USER
accountRouter.post('/update', authenticateToken, async (req, res) => {
  const { firstname, lastname, login, password, birthday, email, phone } = req.body;

  await getUsersAsync();
  const currentUser = users.find(u => u.login === req.user.login);

  if (!currentUser) return res.status(401).send("Unauthorized");

  const updatedUser = {
    firstname: firstname || currentUser.firstname,
    lastname: lastname || currentUser.lastname,
    login: login || currentUser.login,
    password: password || currentUser.password,
    birthday: birthday || currentUser.birthday,
    email: email || currentUser.email,
    phoneNumber: phone || currentUser.phoneNumber
  };

  request.put({
    url: `http://192.168.1.102:3000/users/${currentUser._id}`,
    json: updatedUser
  }, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      return res.status(200).send("User updated successfully");
    } else {
      console.error('Update error:', error || body);
      return res.status(500).send("Update failed");
    }
  });
});

// IS LOGGED?
accountRouter.post('/logged', authenticateToken, (req, res) => {
  return res.status(200).send(true);
});

// GET USER INFO
accountRouter.get('/profile', authenticateToken, async (req, res) => {
  await getUsersAsync();
  const user = users.find(u => u.login === req.user.login);

  if (!user) return res.status(401).send("Unauthorized");

  const userInfo = {
    firstname: user.firstname,
    lastname: user.lastname,
    login: user.login,
    birthday: user.birthday,
    email: user.email,
    phoneNumber: user.phoneNumber
  };

  return res.status(200).json(userInfo);
});

app.listen(port, () => {
  console.log(`Server running on http://192.168.1.88:${port}`);
});
