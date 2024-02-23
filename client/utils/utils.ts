import { Message } from "venom-bot";
import { find } from "../../server/model/userModel";
import dotenv from "dotenv";

// import { consultUserByNumber } from "../../server/controller/userController.js";

const fs = require("fs");
const cron = require("node-cron");

dotenv.config();
const serverPort = process.env.SERVER_PORT;

cron.schedule("0 0 1 * *", () => {
  resetDB();
  console.log(
    `Tarefa agendada para limpar o arquivo ${filePath} no primeiro dia de cada mês.`
  );
});

const filePath = "db.json";

export function hasValidURL(words: string[]): string | null {
  let urlEncontrada = null;

  for (const word of words) {
    if (/^.+\..+/.test(word)) {
      urlEncontrada = word;
      break;
    }
  }

  return urlEncontrada;
}

export function getUsefulWhoisData(data: any): Object | undefined {
  console.log("get whois");
  console.log(data["entities"][0].publicIds[0]);
  try {
    const usefulData = {
      domain: data.handle,
      created: data.events[0].eventDate.split("T")[0],
      changed: data.events[1].eventDate.split("T")[0],
      expiration: data.events[2]
        ? data.events[2].eventDate.split("T")[0]
        : null,
      cnpj: data["entities"][0].publicIds[0].identifier,
      type: data["entities"][0].publicIds[0].type,
    };
    return usefulData;
  } catch (err) {
    console.error("Erro ao consultar dados whois", err);
  }
}

export function getUsefulRFData(data: any): Object {
  const usefulData = {
    name: data.nome,
    date: data.data_situacao,
    active_cnpj: data.situacao == "ATIVA" ? true : false,
    tel: data.telefone,
    email: data.email,
    address: {
      place: data.logradouro,
      number: data.numero,
      cep: data.cep,
      city: data.municipio,
      uf: data.uf,
    },
  };

  return usefulData;
}

export function mergeData(whoIsData: Object, rfData: Object): Object {
  console.log("merging");
  const usefulRfData = getUsefulRFData(rfData);
  const mergedData = { ...whoIsData, ...usefulRfData };

  return mergedData;
}
export function insertData(data: Object) {
  let jsonData = [];

  try {
    const existingData = fs.readFileSync(filePath, "utf-8");
    if (existingData.trim() !== "") {
      jsonData = JSON.parse(existingData);
      if (!Array.isArray(jsonData)) {
        throw new Error("O arquivo não contém um JSON válido como array.");
      }
    }
  } catch (error) {
    console.error(
      `Ao dar insert, obteve erro ao ler ou analisar ${filePath}:`,
      error
    );
  }

  jsonData.push(data);

  const jsonString = JSON.stringify(jsonData, null, 2);

  try {
    fs.writeFileSync(filePath, jsonString);
  } catch (error) {
    console.error(
      `Ao dar insert, obteve erro ao escrever em ${filePath}:`,
      error
    );
  }
}

export function getDataFromDB(url: string) {
  console.log("searching DB");
  let jsonData = [];
  try {
    const existingData = fs.readFileSync(filePath, "utf-8");
    if (!existingData) return null;
    jsonData = JSON.parse(existingData);

    let matchingObject = null;

    jsonData.forEach((element: any) => {
      if (
        element.domain === url ||
        element.domain === "www." + url ||
        element.domain === url.replace("www.", "")
      ) {
        console.log(element.domain, "equal");
        matchingObject = element;
        return;
      }
    });

    return matchingObject;
  } catch (error) {
    console.error(
      `Ao dar get, obteve erro ao ler ou analisar ${filePath}:`,
      error
    );
    return null;
  }
}

function resetDB() {
  try {
    // Limpar o conteúdo do arquivo definindo-o como uma string vazia.
    fs.writeFileSync(filePath, "", "utf-8");
    console.log(`Limpeza realizada no arquivo ${filePath}.`);
  } catch (error) {
    console.error(`Erro ao limpar o arquivo ${filePath}:`, error);
  }
}

export async function getWhoisData(url: string) {
  console.log("searching whois data");
  try {
    const response = await fetch(`http://server:${serverPort}/whois/${url}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (response.status === 404) {
      return null;
    }
    console.log(response.status);
    return await response.json();
  } catch (error) {
    console.error("Erro ao obter dados Whois.", error);
    return null;
  }
}

export async function getRfData(cnpj: string) {
  console.log("searching receita data");
  const cnpjSanitized = cnpj.replace(/[^\d]+/g, "");
  try {
    let response = await fetch(
      `http://server:${serverPort}/receita/${cnpjSanitized}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log(response.status);
    if (response.status === 404) {
      return null;
    }
    console.log(response.status, "Busca Receita");
    return await response.json();
  } catch (error) {
    console.error("Erro ao obter dados Receita.");
    return null;
  }
}
async function findUser(number: String) {
  const numberSanitized = number.split("@")[0];
  console.log("checking user");
  try {
    let response = await fetch(
      `http://server:${serverPort}/api/users/number/${numberSanitized}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log(response.status);
    if (response.status === 404) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Erro ao obter usuário.");
    return null;
  }
}
export async function saveMessageSender(message: Message) {
  try {
    const url = `http://server:${serverPort}/api/users`;
    if (!message.sender) {
      console.error("Sender not defined in message:", message);
      return;
    }

    const { id: number, pushname: name } = message.sender;

    const isUserRegistered = await findUser(number);
    if (isUserRegistered.exists) {
      console.log("User already exists");
      return false;
    }
    if (message.body != "1") return true;

    const data = {
      number,
      name,
    };
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to save user. Status: ${response.status}`);
    }

    const responseData = await response.json();
    console.log("User saved successfully:", responseData);
    return true;
  } catch (error: any) {
    console.error("Error saving user:", error.message);
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
