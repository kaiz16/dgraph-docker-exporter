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

async function EXPORT_DATA(token) {
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

  const { data } = await axios.post(graphqlEndpoint, query, {
    headers: {
      "Content-Type": "application/json",
      "X-Dgraph-AuthToken": token,
    },
  });

  return data?.data?.export?.response || {};
}

async function CHECK_TASK(id, token) {
  const query = JSON.stringify({
    query: `
      query Task($id: String!) {
        task(input: {
          id: $id
        }){
          kind
          status
        }
      }
    `,
    variables: {
      id,
    },
  });

  const { data } = await axios.post(graphqlEndpoint, query, {
    headers: {
      "Content-Type": "application/json",
      "X-Dgraph-AuthToken": token,
    },
  });

  return data?.data?.task || {};
}

app.get("/", async (req, res) => {
  const token = req.headers["x-dgraph-authtoken"];
  if (!token) return res.json("Authorization failed");

  // Export Data
  console.log("Export data");
  const { code, message } = await EXPORT_DATA(token).catch((err) => {
    console.log(err);
    return res.json("Export failed");
  });
  console.log(code, message);
  if (!code || code !== "Success") {
    return res.json("Export failed");
  }

  // Check export status every 1s
  console.log("Check task");
  const taskID = message.split(" ").pop();
  console.log("Task ID", taskID);

  let taskStatus;
  const timer = (ms) => new Promise((res) => setTimeout(res, ms));

  while (true) {
    const { status } = await CHECK_TASK(taskID, token).catch((err) => {
      console.log(err);
      return res.json("Export failed");
    });

    taskStatus = status;

    if (status === "Success" || status === "Failed" || status === "Unknown") {
      break;
    }
    await timer(1000);
  }

  console.log("Task Status", taskStatus);
  if (taskStatus !== "Success") {
    return res.json("Export failed");
  }

  shell.exec("./extract.sh");

  const date = new Date().toLocaleTimeString().replace(/ |,/g, "_");

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
});

app.listen(port, () => {
  console.log(`Exporter is running on port ${port}`);
});
