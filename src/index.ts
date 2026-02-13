import {createServer} from "http";
import {env} from "./env";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from 'url';
import { authRouter } from "./routes/auth.routes";
import { cardsRouter } from './routes/cards.routes';
import { decksRouter } from './routes/decks.routes';
import { loadSwaggerDocs } from './swagger';

// Get __filename equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

// Create Express app
export const app = express();

// Load Swagger documentation
const swaggerDocument = loadSwaggerDocs();

// Middlewares
app.use(
    cors({
        origin: true,  // Autorise toutes les origines
        credentials: true,
    }),
);

app.use(express.json());

// Serve static files (Socket.io test client)
app.use(express.static('public'));

// Health check endpoint
app.get("/api/health", (_req, res) => {
    res.json({status: "ok", message: "TCG Backend Server is running"});
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customSiteTitle: "TCG API Documentation",
    customCss: '.swagger-ui .topbar { display: none }',
}));

// Routes
app.use("/api/auth", authRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/decks', decksRouter);

// Start server only if this file is run directly (not imported for tests)
if (isMainModule) {
    // Create HTTP server
    const httpServer = createServer(app);

    // Start server
    try {
        httpServer.listen(env.PORT, () => {
            console.log(`\n🚀 Server is running on http://localhost:${env.PORT}`);
            console.log(`📚 API Documentation available at http://localhost:${env.PORT}/api-docs`);
            console.log(`🧪 Socket.io Test Client available at http://localhost:${env.PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}