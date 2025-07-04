const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { BlobServiceClient } = require('@azure/storage-blob');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const intoStream = require('into-stream');

const app = express();
const port = process.env.PORT || 3000;

// ========== MIDDLEWARE ========== //
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ========== COSMOS DB (BASE DE DADOS) ========== //
const cosmosEndpoint = "https://basedadostrabalho.documents.azure.com:443/";
const cosmosKey = "ffN5IHmRT9Nxe2GGslV8GD7A61Joed3IT7p0OwxMYHzbte05YJyIjJA1NYbi8X4xZaBEh1Fx0j6aACDbC1Fh6A==";
const databaseId = 'trabalho';
const utilizadoresContainerId = 'utilizador';
const trabalhosContainerId = 'trabalhos';

const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });

// ========== AZURE STORAGE (IMAGENS) ========== //
const AZURE_STORAGE_CONNECTION_STRING = "DefaultEndpointsProtocol=https;AccountName=miniprojeto;AccountKey=lGFDdXuwQSpPmbTRXCb5kQzeBlQtwDV/GnMkv6Fy3tX+n/EhkUmEX5mYu+loeVzDFNZ3r5pAZYzZ+AStS1HDYw==;EndpointSuffix=core.windows.net"; // 🔴 SUBSTITUIR PELA SUA CONNECTION STRING
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerName = "imagens";
const containerClient = blobServiceClient.getContainerClient(containerName);

// ========== MULTER (UPLOAD DE FICHEIROS) ========== //
const upload = multer({ storage: multer.memoryStorage() });

// ========== ROTAS DE PÁGINAS HTML ========== //
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/pagina.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pagina.html')));
app.get('/logout.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'logout.html')));
app.get('/submeter.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'submeter.html')));
app.get('/avaliacoes.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'avaliacoes.html')));
app.get('/criar.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'criar.html')));

// ========== ROTAS DE AUTENTICAÇÃO ========== //
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log("⚠️ [LOGIN RECEBIDO]", username, password);

  try {
    const database = cosmosClient.database(databaseId);
    const container = database.container(utilizadoresContainerId);

    const query = {
      query: "SELECT * FROM c WHERE c.nome = @username AND c.pass = @password",
      parameters: [
        { name: "@username", value: username },
        { name: "@password", value: password }
      ]
    };

    const { resources } = await container.items.query(query).fetchAll();

    if (resources.length > 0) {
      console.log("✅ Login válido");
      res.json({ success: true });
    } else {
      console.log("❌ Login inválido");
      res.json({ success: false });
    }
  } catch (err) {
    console.error("💥 Erro na BD:", err);
    res.status(500).json({ success: false });
  }
});

app.post('/criar-utilizador', async (req, res) => {
  const { nome, email, pass } = req.body;

  try {
    const database = cosmosClient.database(databaseId);
    const container = database.container(utilizadoresContainerId);

    // Verificar se o utilizador já existe
    const { resources } = await container.items.query({
      query: "SELECT * FROM c WHERE c.nome = @nome",
      parameters: [{ name: "@nome", value: nome }]
    }).fetchAll();

    if (resources.length > 0) {
      return res.json({ success: false, message: "Utilizador já existe" });
    }

    const novo = { nome, email, pass };
    await container.items.create(novo);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erro ao criar utilizador:", err);
    res.status(500).json({ success: false });
  }
});

// ========== ROTAS DE TRABALHOS ========== //
app.get('/trabalhos', async (req, res) => {
  try {
    const database = cosmosClient.database(databaseId);
    const container = database.container(trabalhosContainerId);

    const query = {
      query: "SELECT c.titulo, c.avaliado, c.linkFeedback FROM c"
    };

    const { resources } = await container.items.query(query).fetchAll();
    res.json(resources);
  } catch (err) {
    console.error("❌ Erro ao obter trabalhos:", err);
    res.status(500).json({ success: false });
  }
});

// ========== ROTAS DE IMAGENS (AZURE STORAGE) ========== //
app.post('/upload-imagem', upload.single('imagem'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Nenhum arquivo enviado" });
  }

  try {
    const blobName = `${Date.now()}-${req.file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    const stream = intoStream(req.file.buffer);
    const streamLength = req.file.buffer.length;

    await blockBlobClient.uploadStream(stream, streamLength);
    
    const url = blockBlobClient.url;
    res.json({ success: true, url: url });
  } catch (err) {
    console.error("Erro ao fazer upload da imagem:", err);
    res.status(500).json({ success: false, message: "Erro ao fazer upload da imagem" });
  }
});

app.get('/listar-imagens', async (req, res) => {
  try {
    const imagens = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      const blobClient = containerClient.getBlobClient(blob.name);
      imagens.push({
        name: blob.name,
        url: blobClient.url
      });
    }
    res.json({ success: true, imagens: imagens });
  } catch (err) {
    console.error("Erro ao listar imagens:", err);
    res.status(500).json({ success: false, message: "Erro ao listar imagens" });
  }
});

// ========== INICIAR SERVIDOR ========== //
app.listen(port, () => {
  console.log(`🚀 Servidor a correr na porta ${port}`);
});
