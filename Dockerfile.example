FROM node:slim
WORKDIR /usr/src/app
ENV PORT=4004
ENV MYSQL_HOST=buyrkycax0rxy1iazk76-mysql.services.clever-cloud.com
ENV MYSQL_USER=uszbme5qfziezkzr
ENV MYSQL_PASSWORD=2qXZ9F1Wu3qdILhrbgH2
ENV MYSQL_DB=buyrkycax0rxy1iazk76
ENV REDIS_HOST=redis-18979.c291.ap-southeast-2-1.ec2.cloud.redislabs.com
ENV REDIS_PORT=18979
ENV REDIS_PASSWORD=9pVRfkdlq5jkDH95sFELSB3GnPikihBC
COPY package.json .

RUN yarn install
COPY . .
EXPOSE 4004
CMD ["yarn", "server"] 