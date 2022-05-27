const loadEnv = () => {
  require("dotenv").config({ path: __dirname + "/.env" });
};
module.exports = loadEnv;
