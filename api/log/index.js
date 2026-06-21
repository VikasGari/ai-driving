const { TableClient } = require("@azure/data-tables");

// Determine storage option (Use Azure Table Storage if connection string is configured, otherwise fallback to in-memory)
const connString = process.env.CUSTOM_STORAGE_CONNECTION || process.env.AzureWebJobsStorage;
const useAzureTable = connString && connString !== "UseDevelopmentStorage=true" && !connString.startsWith("DefaultEndpointsProtocol=http;AccountName=devstoreaccount1");
const tableName = "proposallogs";

let tableClient = null;

if (useAzureTable) {
    try {
        tableClient = TableClient.fromConnectionString(connString, tableName);
    } catch (err) {
        console.error("Failed to initialize TableClient. Falling back to in-memory logs.", err);
        tableClient = null;
    }
} else {
    console.log("Using in-memory log database for local development.");
}

// Global in-memory storage fallback for local dev
if (!global.localLogs) {
    global.localLogs = [];
}

module.exports = async function (context, req) {
    context.res = {
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    };

    if (req.method === "OPTIONS") {
        context.res.status = 204;
        return;
    }

    try {
        if (req.method === "POST") {
            const { action, details } = req.body || {};
            if (!action) {
                context.res.status = 400;
                context.res.body = { error: "Action is required" };
                return;
            }

            const rawIp = req.headers["x-forwarded-for"] || req.headers["client-ip"] || req.headers["x-real-ip"] || "127.0.0.1";
            const ip = rawIp.split(',')[0].trim();
            const userAgent = req.headers["user-agent"] || "unknown";
            const timestamp = new Date().toISOString();
            const rowKey = (Number.MAX_SAFE_INTEGER - Date.now()).toString();

            const logEntity = {
                partitionKey: "logs",
                rowKey: rowKey,
                timestamp: timestamp,
                action: action,
                details: typeof details === "object" ? JSON.stringify(details) : (details || ""),
                ip: ip,
                userAgent: userAgent
            };

            let savedToAzure = false;
            if (tableClient) {
                try {
                    await tableClient.createTable();
                    await tableClient.createEntity(logEntity);
                    savedToAzure = true;
                } catch (err) {
                    console.error("Azure Table Storage error, falling back to in-memory:", err);
                }
            }

            if (!savedToAzure) {
                global.localLogs.push(logEntity);
                global.localLogs.sort((a, b) => a.rowKey.localeCompare(b.rowKey));
            }

            context.res.status = 201;
            context.res.body = { success: true, savedToAzure };
            return;
        } 
        
        if (req.method === "GET") {
            let logs = [];
            if (tableClient) {
                try {
                    await tableClient.createTable();
                    const entities = tableClient.listEntities();
                    for await (const entity of entities) {
                        logs.push({
                            partitionKey: entity.partitionKey,
                            rowKey: entity.rowKey,
                            timestamp: entity.timestamp,
                            action: entity.action,
                            details: entity.details,
                            ip: entity.ip,
                            userAgent: entity.userAgent
                        });
                    }
                } catch (err) {
                    console.error("Failed to fetch logs from Azure Table Storage, returning in-memory:", err);
                    logs = [...global.localLogs];
                }
            } else {
                logs = [...global.localLogs];
            }

            // Return in chronological order (newest first, i.e., ascending rowKey since it is MAX - Date.now())
            logs.sort((a, b) => a.rowKey.localeCompare(b.rowKey));

            context.res.status = 200;
            context.res.body = { logs };
            return;
        }

        if (req.method === "DELETE") {
            if (tableClient) {
                try {
                    await tableClient.createTable();
                    const entities = tableClient.listEntities();
                    for await (const entity of entities) {
                        await tableClient.deleteEntity(entity.partitionKey, entity.rowKey);
                    }
                } catch (err) {
                    console.error("Failed to delete entities from Azure Table Storage:", err);
                    throw err;
                }
            }
            
            global.localLogs = [];
            
            context.res.status = 200;
            context.res.body = { success: true, message: "Logs cleared successfully." };
            return;
        }

        context.res.status = 405;
        context.res.body = { error: "Method not allowed" };
    } catch (error) {
        context.log.error("Internal Server Error in log function:", error);
        context.res.status = 500;
        context.res.body = { error: "Internal Server Error", message: error.message };
    }
};
