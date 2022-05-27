const express = require("express");
const { Storage } = require("@google-cloud/storage");
const axios = require("axios");
const shell = require("shelljs");
const fs = require("fs");
const loadEnv = require("./loadEnv");
loadEnv();
const app = express();
const port = 9999;

const graphqlEndpoint = "http://127.0.0.1:8080/admin";

app.get("/", async (req, res) => {
  const query = JSON.stringify({
    query: `
      mutation ExportDB{
          export(input: {
              format: "json"
          }){
              response{
                  code
                  message
              }
          }
      }
    `,
  });

  const token = req.headers["x-dgraph-authtoken"];
  if (!token) return res.json("Authorization failed");

  const { data } = await axios
    .post(graphqlEndpoint, query, {
      headers: {
        "Content-Type": "application/json",
        "X-Dgraph-AuthToken": token,
      },
    })
    .catch((err) => {
      console.log(err);
      return res.json("Export failed");
    });

  const code = data?.data?.export?.response?.code;
  if (!code) return res.json("Export failed");

  setTimeout(async () => {
    shell.exec("./extract.sh");

    const date = new Date().toUTCString().replace(/ |,/g, "_");

    // Creates a client from a Google service account key.
    const gc = new Storage({
      // uncomment the line below to run the functions locally
      keyFilename: process.env.KEYFILE,
      projectId: process.env.PROJECT_ID,
    });

    const BUCKET_NAME = process.env.BUCKET_NAME;
    const bucket = gc.bucket(BUCKET_NAME);

    for (const name of ["g01.gql_schema.gz", "g01.json.gz", "g01.schema.gz"]) {
      const file = fs.readFileSync(`./data/${name}`);
      if (!file) return res.json(`Error reading file ${name}`);

      const destination = `backups/export_${date}/${name}`;

      await bucket.upload(`./data/${name}`, {
        destination,
        metadata: {
          // Enable long-lived HTTP caching headers
          // Use only if the contents of the file will never change
          // (If the contents will change, use cacheControl: 'no-cache')
          cacheControl: "private",
          contentType: "application/gzip",
          contentEncoding: "7bit",
        },
      });

      //   clean up
      shell.exec(`rm -rf ./data/${name}`);
    }
    res.json("Ok");
  }, 3000);
});

app.listen(port, () => {
  console.log(`Exporter is running on port ${port}`);
});
