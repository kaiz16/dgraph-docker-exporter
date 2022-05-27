#!/bin/sh
docker stop dgraph-exporter
docker rm dgraph-exporter
# Run this with sudo