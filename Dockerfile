FROM node:21

RUN apt-get update && apt-get install -y libvips-dev

RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /app

COPY . .
COPY package*.json ./

RUN npm install --ignore-scripts=false --verbose sharp
RUN npm install --platform=linux --arch=x64 sharp
RUN npm rebuild --verbose sharp


EXPOSE 1233