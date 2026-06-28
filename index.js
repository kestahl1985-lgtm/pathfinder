const express = require("express");
const handler = require("./api/index.js");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route all requests through the handler
app.all("*", handler);

module.exports = app;
