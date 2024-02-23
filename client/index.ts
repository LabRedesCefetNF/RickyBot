// @ts-nocheck
import { Message, Whatsapp, create } from "venom-bot";
import {
  hasValidURL,
  getUsefulWhoisData,
  mergeData,
  insertData,
  getDataFromDB,
  getWhoisData,
  getRfData,
  saveMessageSender,
  sleep,
} from "./utils/utils";
import {
  printSuccess,
  registerMessage,
  welcomeMessage,
} from "./utils/messages.ts";
import { checkLookup } from "./utils/dns.ts";

const { Mutex } = require("async-mutex");

create({
  session: `chat-bot`,
})
  .then(async (client: Whatsapp) => await start(client))
  .catch((err) => {
    console.log(err);
  });

async function start(client: Whatsapp) {
  const mutex = new Mutex();

  client.onMessage(async (message: Message) => {
    if (!message.body || message.isGroupMsg) return;

    const isFirstMessage = await saveMessageSender(message);
    if (isFirstMessage) {
      if (message.body == "1") {
        await client.sendText(
          message.from,
          welcomeMessage(message.sender.pushname)
        );
        return;
      }
      await client.sendText(
        message.from,
        registerMessage(message.sender.pushname)
      );
      return;
    }

    const words = message.body.split(" ");
    let url = hasValidURL(words);

    if (!url) {
      await client.sendText(
        message.from,
        `Olá! Estou pronto para ajudá-lo a analisar um site.\nPor favor, sinta-se à vontade para compartilhar o link que deseja consultar.`
      );
      return;
    }

    await client.sendText(
      message.from,
      `Obrigado por me enviar um endereço. Consultarei as informações sobre o domínio. 🔍\n→ ${url}`
    );
    await mutex.runExclusive(async () => {
      url = url?.toLowerCase();
      url = url.replace(/https?[:\/]*/gi, "");
      url = url.split("/")[0];
      const sameDNS = await checkLookup(url);
      if (sameDNS && !url.endsWith(".br")) url += ".br";
      try {
        console.log(url);
        const data = await getWhoisData(url);
        if (data["errorCode"] !== 400 && data !== null) {
          await client.sendText(message.from, `O endereço ${url} é válido.`);
          if (getDataFromDB(url)) {
            await client.sendText(
              message.from,
              `${printSuccess(getDataFromDB(url))}`
            );
            return;
          }
          const mutexApi = new Mutex();

          await mutexApi.runExclusive(async () => {
            try {
              await client.sendText(
                message.from,
                `Aguarde um pouco que estou analisando os dados do website. ⏰`
              );
              // await sleep(20000); // Limitado a 3 req./min
              // console.log(data);

              const whoIsData = getUsefulWhoisData(data);
              const rfData = await getRfData(whoIsData.cnpj);
              const resultData = await mergeData(whoIsData, rfData);
              if (resultData) {
                await client.sendText(
                  message.from,
                  `Análise *concluída*.\n\n${printSuccess(resultData)}`
                );
                insertData(resultData);
              }
            } catch {
              await client.sendText(
                message.from,
                `Tive um erro ao tentar consultar o seu link ⤵️\n→ ${url} ⚠️`
              );
            } finally {
              await sleep(20000);
            }
          });
        } else {
          await client.sendText(
            message.from,
            `Não é um endereço existente.\nCertifique-se que foi digitado corretamente e com os devidos espaçamentos.`
          );
          return;
        }
      } catch {
        //Erro no fetch
        await client.sendText(
          message.from,
          `Ocorreu um erro ao consultar os dados administrativos do domínio: ⚠️\n→ ${url}\n
Por favor, verifique se o endereço do site está correto e considere que ele pode não possuir registro no Brasil.\n
Caso o endereço não possua registro no Brasil, tenha *cuidado*, pois fica mais difícil de garantir seus direitos como consumidor. 🧐`
        );
      } //finally {
      //   mutex.release();
      // }
    });
  });
}
