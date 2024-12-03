FROM node:22 AS build

WORKDIR /build

# cache deps in a docker layer
COPY package*.json ./
RUN npm ci

# cache map definition fetching as well
RUN mkdir generators # cringe, but we're just adapting to what was there
COPY ./src/data/map_definitions.json ./
COPY ./src/data/data_generators/map_definitions_maker.cjs ./generators/
RUN node generators/map_definitions_maker.cjs

COPY ./ ./
RUN npm run build && mv tilesources.json public/js/


FROM nginx:latest

RUN apt-get update && apt-get install openssh-server -y && rm -rf /var/cache/apt/archives /var/lib/apt/lists/*

COPY --from=build /build/public /usr/share/nginx/html

