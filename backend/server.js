require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const short = require('short-uuid');

const app = express();
const PORT = process.env.PORT || 5008;

const dataDir = path.join(__dirname, 'data');
const accountsFilePath = path.join(dataDir, 'accounts.json');

// Ensure data directory and file exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
if (!fs.existsSync(accountsFilePath)) {
  fs.writeFileSync(accountsFilePath, JSON.stringify([], null, 2));
}

// Middleware
app.use(cors());
app.use(express.json());

// --- HELPER FUNCTIONS ---

const readAccounts = () => {
  try {
    const data = fs.readFileSync(accountsFilePath);
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading accounts file:", error);
    return [];
  }
};

const writeAccounts = (accounts) => {
  try {
    fs.writeFileSync(accountsFilePath, JSON.stringify(accounts, null, 2));
  } catch (error) {
    console.error("Error writing to accounts file:", error);
  }
};

const getAccountById = (id) => {
  const accounts = readAccounts();
  return accounts.find(acc => acc.id === id);
};

const getAuthHeader = (username, password) => {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
};

// Validate connection to WordPress by fetching lists
const validateWpConnection = async (siteUrl, username, password) => {
  try {
    // Ensure no trailing slash
    const baseUrl = siteUrl.replace(/\/$/, "");
    const endpoint = `${baseUrl}/wp-json/custom-mailpoet/v1/lists`;

    const response = await axios.get(endpoint, {
      headers: {
        'Authorization': getAuthHeader(username, password),
        'Content-Type': 'application/json'
      }
    });

    return {
      status: 'valid',
      validationMessage: JSON.stringify({
        message: "Connected successfully to MailPoet!",
        listsFound: response.data.length,
        statusCode: response.status
      }, null, 2),
    };
  } catch (error) {
    console.error("WP Validation Error:", error.message);
    
    let errorMessage = {
        message: "Could not connect to WordPress site.",
        error: error.message
    };

    if (error.response) {
        errorMessage.status = error.response.status;
        errorMessage.data = error.response.data;
    }

    return {
      status: 'invalid',
      validationMessage: JSON.stringify(errorMessage, null, 2),
    };
  }
};

// --- ROUTES ---

// GET all accounts
app.get('/api/accounts', (req, res) => {
  const accounts = readAccounts();
  // Don't send passwords back to frontend if you want extra security, 
  // but for a local tool, sending them is fine for the context to use.
  res.json(accounts);
});

// POST a new account
app.post('/api/accounts', async (req, res) => {
  const { name, siteUrl, username, appPassword } = req.body;
  
  if (!name || !siteUrl || !username || !appPassword) {
    return res.status(400).json({ message: 'All fields (Name, URL, Username, Password) are required.' });
  }

  const { status, validationMessage } = await validateWpConnection(siteUrl, username, appPassword);

  const accounts = readAccounts();
  const newAccount = {
    id: short.generate(),
    name,
    siteUrl,
    username,
    appPassword,
    status,
    validationMessage
  };
  
  accounts.push(newAccount);
  writeAccounts(accounts);
  res.status(201).json(newAccount);
});

// PUT endpoint to re-validate credentials
app.put('/api/accounts/:id/validate', async (req, res) => {
  const accounts = readAccounts();
  const accountId = req.params.id;
  const accountIndex = accounts.findIndex(acc => acc.id === accountId);

  if (accountIndex === -1) {
    return res.status(404).json({ message: 'Account not found' });
  }

  const acc = accounts[accountIndex];
  const { status, validationMessage } = await validateWpConnection(acc.siteUrl, acc.username, acc.appPassword);
  
  const updatedAccount = {
    ...acc,
    status,
    validationMessage
  };

  accounts[accountIndex] = updatedAccount;
  writeAccounts(accounts);

  res.status(200).json(updatedAccount);
});

// DELETE an account
app.delete('/api/accounts/:id', (req, res) => {
  let accounts = readAccounts();
  const accountId = req.params.id;
  accounts = accounts.filter(acc => acc.id !== accountId);
  writeAccounts(accounts);
  res.status(200).json({ message: 'Account deleted successfully' });
});

// --- MAILPOET PROXY ENDPOINTS ---

// GET Lists (was Tags)
app.get('/api/lists', async (req, res) => {
  const { accountId } = req.query;

  const account = getAccountById(accountId);
  if (!account) return res.status(404).json({ message: "Account not found" });

  try {
    const baseUrl = account.siteUrl.replace(/\/$/, "");
    const response = await axios.get(`${baseUrl}/wp-json/custom-mailpoet/v1/lists`, {
      headers: {
        'Authorization': getAuthHeader(account.username, account.appPassword)
      }
    });
    // Ensure we return an array structure the frontend expects
    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST Subscribe (Create Contact)
app.post('/api/subscribers', async (req, res) => {
  const { accountId, email, list_id, first_name, last_name } = req.body;

  const account = getAccountById(accountId);
  if (!account) return res.status(404).json({ message: "Account not found" });

  try {
    const baseUrl = account.siteUrl.replace(/\/$/, "");
    
    // Prepare data for the WP plugin
    const payload = {
        email,
        first_name: first_name || '',
        last_name: last_name || '',
        lists: list_id ? [list_id] : []
    };

    const response = await axios.post(`${baseUrl}/wp-json/custom-mailpoet/v1/subscribe`, payload, {
      headers: {
        'Authorization': getAuthHeader(account.username, account.appPassword),
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    // Pass through the error from WP if possible
    const errMsg = error.response?.data?.message || error.message;
    res.status(error.response?.status || 500).json({ message: errMsg });
  }
});

// NEW: GET All Subscribers (List View)
app.get('/api/all-subscribers', async (req, res) => {
  const { accountId, limit, offset } = req.query;

  const account = getAccountById(accountId);
  if (!account) return res.status(404).json({ message: "Account not found" });

  try {
    const baseUrl = account.siteUrl.replace(/\/$/, "");
    const response = await axios.get(`${baseUrl}/wp-json/custom-mailpoet/v1/subscribers`, {
      params: { 
        limit: limit || 100,
        offset: offset || 0
      },
      headers: {
        'Authorization': getAuthHeader(account.username, account.appPassword)
      }
    });
    res.status(200).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const msg = error.response?.data?.message || error.message;
    res.status(status).json({ message: msg });
  }
});

// FIXED: DELETE Subscriber
app.delete('/api/subscriber', async (req, res) => {
  const { accountId, email } = req.query;

  const account = getAccountById(accountId);
  if (!account) return res.status(404).json({ message: "Account not found" });

  try {
    const baseUrl = account.siteUrl.replace(/\/$/, "");
    const response = await axios.delete(`${baseUrl}/wp-json/custom-mailpoet/v1/subscriber`, {
      params: { email },
      headers: {
        'Authorization': getAuthHeader(account.username, account.appPassword)
      }
    });
    res.status(200).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const msg = error.response?.data?.message || error.message;
    res.status(status).json({ message: msg });
  }
});




app.listen(PORT, () => {
  console.log(`MailPoet Manager Backend running on http://localhost:${PORT}`);
});