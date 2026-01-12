#!/bin/bash

echo "Stopping ChromaDB container..."
docker-compose stop chroma

echo "Removing ChromaDB container..."
docker-compose rm -f chroma

echo "Removing ChromaDB data volume..."
docker volume rm mfulearnai_chroma

echo "Starting ChromaDB with fresh volume..."
docker-compose up -d --build chroma

echo "Done! Please check 'docker ps' to see if it is healthy."
