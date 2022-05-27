#!/bin/sh
docker build . -t dgraph/dgraph-exporter
docker run --name dgraph-exporter -p 9999:9999 -d dgraph/dgraph-exporter
# Run this with sudo