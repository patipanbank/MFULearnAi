// MongoDB initialization script for AWS Bedrock API Gateway
// This script creates the database, collections, and indexes

print("Initializing MongoDB for AWS Bedrock API Gateway...");

// Switch to the bedrock_gateway database
db = db.getSiblingDB('bedrock_gateway');

// Create collections with validation
print("Creating collections...");

// Usage Records collection
db.createCollection("usage_records", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["request_id", "client_ip", "method", "endpoint", "service_type", "processing_time", "status_code", "timestamp"],
            properties: {
                request_id: {
                    bsonType: "string",
                    description: "Unique request identifier"
                },
                api_key: {
                    bsonType: ["string", "null"],
                    description: "API key used (masked)"
                },
                client_ip: {
                    bsonType: "string",
                    description: "Client IP address"
                },
                method: {
                    bsonType: "string",
                    enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                    description: "HTTP method"
                },
                endpoint: {
                    bsonType: "string",
                    description: "API endpoint"
                },
                service_type: {
                    bsonType: "string",
                    enum: ["chat", "embeddings", "image", "models", "other"],
                    description: "Service type"
                },
                processing_time: {
                    bsonType: "number",
                    minimum: 0,
                    description: "Processing time in seconds"
                },
                status_code: {
                    bsonType: "int",
                    minimum: 100,
                    maximum: 599,
                    description: "HTTP status code"
                },
                timestamp: {
                    bsonType: "date",
                    description: "Request timestamp"
                }
            }
        }
    }
});

// API Key Usage collection
db.createCollection("api_key_usage", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["api_key", "api_key_hash", "total_requests", "created_at"],
            properties: {
                api_key: {
                    bsonType: "string",
                    description: "API key (masked)"
                },
                api_key_hash: {
                    bsonType: "string",
                    description: "Hashed API key for tracking"
                },
                total_requests: {
                    bsonType: "int",
                    minimum: 0,
                    description: "Total number of requests"
                },
                successful_requests: {
                    bsonType: "int",
                    minimum: 0,
                    description: "Number of successful requests"
                },
                failed_requests: {
                    bsonType: "int",
                    minimum: 0,
                    description: "Number of failed requests"
                }
            }
        }
    }
});

// Daily Stats collection
db.createCollection("daily_stats", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["date", "total_requests", "created_at"],
            properties: {
                date: {
                    bsonType: "string",
                    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                    description: "Date in YYYY-MM-DD format"
                },
                total_requests: {
                    bsonType: "int",
                    minimum: 0,
                    description: "Total requests for the day"
                },
                successful_requests: {
                    bsonType: "int",
                    minimum: 0,
                    description: "Successful requests"
                },
                failed_requests: {
                    bsonType: "int",
                    minimum: 0,
                    description: "Failed requests"
                }
            }
        }
    }
});

// System Metrics collection
db.createCollection("system_metrics", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["timestamp", "period_start", "period_end"],
            properties: {
                timestamp: {
                    bsonType: "date",
                    description: "Metric timestamp"
                },
                period_start: {
                    bsonType: "date",
                    description: "Start of measurement period"
                },
                period_end: {
                    bsonType: "date",
                    description: "End of measurement period"
                },
                avg_response_time: {
                    bsonType: "number",
                    minimum: 0,
                    description: "Average response time"
                },
                requests_per_second: {
                    bsonType: "number",
                    minimum: 0,
                    description: "Requests per second"
                }
            }
        }
    }
});

print("Creating indexes...");

// Usage Records indexes
db.usage_records.createIndex({ "timestamp": -1 });
db.usage_records.createIndex({ "api_key": 1 });
db.usage_records.createIndex({ "endpoint": 1 });
db.usage_records.createIndex({ "status_code": 1 });
db.usage_records.createIndex({ "service_type": 1 });
db.usage_records.createIndex({ "client_ip": 1 });
db.usage_records.createIndex({ "request_id": 1 }, { unique: true });

// Compound indexes for common queries
db.usage_records.createIndex({ "api_key": 1, "timestamp": -1 });
db.usage_records.createIndex({ "service_type": 1, "timestamp": -1 });
db.usage_records.createIndex({ "status_code": 1, "timestamp": -1 });

// API Key Usage indexes
db.api_key_usage.createIndex({ "api_key_hash": 1 }, { unique: true });
db.api_key_usage.createIndex({ "updated_at": -1 });
db.api_key_usage.createIndex({ "total_requests": -1 });
db.api_key_usage.createIndex({ "last_request": -1 });

// Daily Stats indexes
db.daily_stats.createIndex({ "date": -1 });
db.daily_stats.createIndex({ "api_key": 1, "date": -1 });
db.daily_stats.createIndex({ "date": 1, "api_key": 1 }, { unique: true });

// System Metrics indexes
db.system_metrics.createIndex({ "timestamp": -1 });
db.system_metrics.createIndex({ "period_start": -1 });

print("Creating TTL indexes for data retention...");

// TTL index for automatic cleanup of old usage records (90 days)
db.usage_records.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// TTL index for system metrics (1 year)
db.system_metrics.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

print("Creating user and permissions...");

// Create application user with appropriate permissions
if (typeof process.env.MONGODB_USERNAME !== 'undefined' && typeof process.env.MONGODB_PASSWORD !== 'undefined') {
    db.createUser({
        user: process.env.MONGODB_USERNAME,
        pwd: process.env.MONGODB_PASSWORD,
        roles: [
            {
                role: "readWrite",
                db: "bedrock_gateway"
            }
        ]
    });
    print("Created application user: " + process.env.MONGODB_USERNAME);
} else {
    print("MongoDB username/password not provided, skipping user creation");
}

print("Creating initial stats document...");

// Create initial daily stats document for today
const today = new Date().toISOString().split('T')[0];
db.daily_stats.insertOne({
    date: today,
    total_requests: 0,
    successful_requests: 0,
    failed_requests: 0,
    chat_requests: 0,
    embedding_requests: 0,
    image_requests: 0,
    total_request_size: 0,
    total_response_size: 0,
    avg_processing_time: 0.0,
    max_processing_time: 0.0,
    rate_limit_hits: 0,
    unique_clients: 0,
    unique_api_keys: 0,
    error_counts: {},
    status_code_counts: {},
    created_at: new Date(),
    updated_at: new Date()
});

print("MongoDB initialization completed successfully!");
print("Database: bedrock_gateway");
print("Collections created: usage_records, api_key_usage, daily_stats, system_metrics");
print("Indexes created for optimal query performance");
print("TTL indexes configured for automatic data cleanup");
print("Application ready for production use!");

// Show collection stats
print("\nCollection statistics:");
db.stats();
db.usage_records.stats();
db.api_key_usage.stats();
db.daily_stats.stats();
db.system_metrics.stats(); 