console.log("🔍 AZURE_STORAGE_CONNECTION_STRING:", process.env.AZURE_STORAGE_CONNECTION_STRING);

const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Cosmos DB config
const endpoint = "https://basedadostrabalho.documents.azure.com:443/";
const key = "ffN5IHmRT9Nxe2GGslV8GD7A61Joed3IT7p0OwxMYHzbte05YJyIjJA1NYbi8X4xZaBEh1Fx0j6aACDbC1Fh6A==";
const databaseId = 'trabalho';
const utilizadoresContainerId = 'utilizador';
const trabalhosContainerId = 'trabalhos';

const client = new CosmosClient({ endpoint, key });

// Azure Blob Storage (usando variável de ambiente)
const blobConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const blobServiceClient = BlobServiceClient.fromConnectionString(blobConnectionString);
const containerName = 'imagens';

// Configurar Multer para upload em memória
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Páginas
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/pagina.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pagina.html')));
app.get('/logout.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'logout.html')));
app.get('/submeter.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'submeter.html')));
app.get('/avaliacoes.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'avaliacoes.html')));
app.get('/criar.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'criar.html')));

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const container = client.database(databaseId).container(utilizadoresContainerId);
    const query = {
      query: "SELECT * FROM c WHERE c.nome = @username AND c.pass = @password",
      parameters: [
        { name: "@username", value: username },
        { name: "@password", value: password }
      ]
    };
    const { resources } = await container.items.query(query).fetchAll();
    res.json({ success: resources.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Criar utilizador
app.post('/criar-utilizador', async (req, res) => {
  const { nome, email, pass } = req.body;
  try {
    const container = client.database(databaseId).container(utilizadoresContainerId);
    const query = {
      query: "SELECT * FROM c WHERE c.nome = @nome",
      parameters: [{ name: "@nome", value: nome }]
    };
    const { resources } = await container.items.query(query).fetchAll();
    if (resources.length > 0) return res.json({ success: false, message: "Utilizador já existe" });

    await container.items.create({ nome, email, pass });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Obter trabalhos
app.get('/trabalhos', async (req, res) => {
  try {
    const container = client.database(databaseId).container(trabalhosContainerId);
    const query = { query: "SELECT c.titulo, c.avaliado, c.linkFeedback FROM c" };
    const { resources } = await container.items.query(query).fetchAll();
    res.json(resources);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Upload de trabalho com ficheiro
app.post('/upload-trabalho', upload.single('ficheiro'), async (req, res) => {
  try {
    const { nomeTrabalho, id_utilizador } = req.body;
    const file = req.file;

    if (!file || !id_utilizador || !nomeTrabalho) {
      return res.status(400).send('Faltam dados obrigatórios.');
    }

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobName = `${id_utilizador}-${Date.now()}-${file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(file.buffer, file.buffer.length);

    const fileUrl = `https://${blobServiceClient.accountName}.blob.core.windows.net/${containerName}/${blobName}`;

    const container = client.database(databaseId).container(trabalhosContainerId);
    const trabalho = {
      id: crypto.randomUUID(),
      id_utilizador,
      titulo: nomeTrabalho,
      avaliado: false,
      linkFeedback: fileUrl,
      criadoEm: new Date().toISOString()
    };

    await container.items.create(trabalho);
    res.status(200).json({ message: 'Upload feito com sucesso!', url: fileUrl });
  } catch (err) {
    console.error('Erro ao fazer upload:', err);
    res.status(500).send('Erro ao fazer upload.');
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor a correr na porta ${port}`);
});
