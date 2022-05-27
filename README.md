Export the database and upload it to Google Cloud Storage.

```
npm install
npm run start
```

```js
import axios from "axios";

const options = {
  method: 'GET',
  url: 'http://127.0.0.1:9999/',
  headers: {'Content-Type': 'application/json', 'X-Dgraph-AuthToken': 'TOP_SECRET'}
};

axios.request(options).then(function (response) {
  console.log(response.data);
}).catch(function (error) {
  console.error(error);
});
```