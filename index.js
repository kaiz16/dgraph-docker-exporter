import express from "express";
import axios from "axios";
import shell from "shelljs";
import FormData from "form-data";
import fs from "fs";
const app = express();
const port = 9999;
const uploadEndpoint =
  "https://asia-southeast2-hantargo-v1.cloudfunctions.net/upload-staging";

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
    .post("http://127.0.0.1:8080/admin", query, {
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

  shell.exec("./extract.sh");

  const date = new Date().toUTCString().replace(/ |,/g, "_");
  for (const name of ["g01.gql_schema.gz", "g01.json.gz", "g01.schema.gz"]) {
    const file = fs.readFileSync(`./data/${name}`);
    if (!file) return res.json(`Error reading file ${name}`);

    const form = new FormData();
    form.append("file", file, name);

    await axios
      .post(`${uploadEndpoint}/backups/export_${date}`, form, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      .catch((err) => {
        console.log(err);
        return res.json("Upload failed");
      });
    
    //   clean up
    shell.exec(`rm -rf ./data/${name}`);
  }

  res.json("Ok");
});

app.listen(port, () => {
  console.log(`Exporter is running on port ${port}`);
});
