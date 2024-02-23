import fetch from "node-fetch";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import dotenv from "dotenv";

import UserSchema from "./model/userModel.js";
const app = express();

dotenv.config();
const serverPort = process.env.SERVER_PORT;

import routes from "./routes/routes.js";

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Conexão bem-sucedida com o MongoDB");
  })
  .catch((err) => {
    console.error(`Erro na conexão com o MongoDB: ${err.message}`);
  });

app.use(express.json());

app.use(
  cors({
    origin: "*",
  })
);
app.use("/api", routes);

app.get("/whois/:slug", async (req, res) => {
  try {
    var slug = req.params.slug;
    const response = await fetch(`https://rdap.registro.br/domain/${slug}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    res.json(await response.json());
    if (response.status == 404)
      return res.status(404).json({ error: "URL não encontrada." });
  } catch (e) {
    console.error("URL Inválida.");
    return res.status(404).json({ error: "URL não encontrada." });
  }
});

app.get("/receita/:slug", async (req, res) => {
  var slug = req.params.slug;
  const response = await fetch(`https://receitaws.com.br/v1/cnpj/${slug}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  res.json(await response.json());
});

app.get("/api/users/number/:numero", async (req, res) => {
  const number = parseInt(req.params.numero);

  try {
    const user = await UserSchema.exists({ number: number });

    res.json({ exists: !!user });
  } catch (error) {
    console.error("Erro na verificação do número:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.listen(serverPort, () => {
  console.log("Server running: ", serverPort);
});
