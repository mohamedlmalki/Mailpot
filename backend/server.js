require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const short = require('short-uuid');

const app = express();
const PORT = process.env.PORT || 5006;

const dataDir = path.join(__dirname, 'data');
const accountsFilePath = path.join(dataDir, 'accounts.json');

// SETUP...
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
if (!fs.existsSync(accountsFilePath)) {
  fs.writeFileSync(accountsFilePath, JSON.stringify([], null, 2));
}

// Middleware
app.use(cors());
app.use(express.json());

// Helper functions
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

// **Helper function with the SYSTEM.IO API endpoint**
const validateApiKey = async (apiKey) => {
  try {
    // **CORRECTED ENDPOINT: Use System.io community endpoint for validation**
    const systemIoResponse = await axios.get('https://api.systeme.io/api/community/communities', {
      headers: { 
        'X-API-Key': apiKey,
        'accept': 'application/json'
      }
    });
    
    return {
      status: 'valid',
      validationMessage: JSON.stringify({
        message: "API key is valid and connected successfully to System.io.",
        statusCode: systemIoResponse.status,
        originalResponse: systemIoResponse.data
      }, null, 2),
    };
  } catch (error) {
    console.error("API Validation Error:", error);

    let errorMessage;
    if (error.response) {
      errorMessage = {
        message: "System.io API returned an error.",
        status: error.response.status,
        data: error.response.data
      };
    } else if (error.request) {
      errorMessage = {
        message: "Network error: No response received from System.io API.",
        request: "Check your internet connection and backend proxy/firewall settings."
      };
    } else {
      errorMessage = {
        message: "An unknown error occurred during the API request setup.",
        error: error.message
      };
    }
    
    return {
      status: 'invalid',
      validationMessage: JSON.stringify(errorMessage, null, 2),
    };
  }
};

// GET all accounts
app.get('/api/accounts', (req, res) => {
  const accounts = readAccounts();
  res.json(accounts);
});

// POST a new account
app.post('/api/accounts', async (req, res) => {
  const { name, apiKey } = req.body;
  if (!name || !apiKey) {
    return res.status(400).json({ message: 'Name and API key are required.' });
  }

  const { status, validationMessage } = await validateApiKey(apiKey);

  const accounts = readAccounts();
  const newAccount = {
    id: short.generate(),
    name,
    apiKey,
    status,
    validationMessage
  };
  
  accounts.push(newAccount);
  writeAccounts(accounts);
  res.status(201).json(newAccount);
});

// PUT endpoint to re-validate a key
app.put('/api/accounts/:id/validate', async (req, res) => {
  const accounts = readAccounts();
  const accountId = req.params.id;
  const accountIndex = accounts.findIndex(acc => acc.id === accountId);

  if (accountIndex === -1) {
    return res.status(404).json({ message: 'Account not found' });
  }

  const accountToValidate = accounts[accountIndex];
  const { status, validationMessage } = await validateApiKey(accountToValidate.apiKey);
  
  const updatedAccount = {
    ...accountToValidate,
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

// **ENDPOINT TO CREATE A CONTACT IN SYSTEM.IO**
app.post('/api/contacts', async (req, res) => {
  const { apiKey, ...contactData } = req.body;

  if (!apiKey) {
    return res.status(400).json({ message: "API Key is required." });
  }

  try {
    // System.io creates contacts via POST /api/contacts
    const response = await axios.post('https://api.systeme.io/api/contacts', contactData, {
      headers: { 
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      }
    });
    res.status(200).json(response.data);
  } catch (error) {
    console.error("System.io Contact Creation Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { message: "An internal server error occurred." });
  }
});

// **ENDPOINT TO GET TAGS**
app.get('/api/tags', async (req, res) => {
  const { apiKey } = req.query;

  if (!apiKey) {
    return res.status(400).json({ message: "API Key is required via query parameter." });
  }

  try {
    const response = await axios.get('https://api.systeme.io/api/tags', {
      headers: {
        'X-API-Key': apiKey,
        'accept': 'application/json'
      }
    });
    res.status(200).json(response.data);
  } catch (error) {
    console.error("System.io Get Tags Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { message: "Failed to fetch tags." });
  }
});

// **ENDPOINT TO ASSIGN TAG TO CONTACT**
app.post('/api/contacts/:id/tags', async (req, res) => {
  const { id } = req.params; // Contact ID
  const { apiKey, tagId } = req.body;

  if (!apiKey || !tagId) {
    return res.status(400).json({ message: "API Key and Tag ID are required." });
  }

  try {
    const response = await axios.post(`https://api.systeme.io/api/contacts/${id}/tags`, { tagId: tagId }, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      }
    });
    res.status(200).json(response.data);
  } catch (error) {
    console.error("System.io Assign Tag Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { message: "Failed to assign tag." });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});