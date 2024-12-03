FROM node:22 AS frontend

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

FROM node:22 AS backend

WORKDIR /build

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
COPY tsconfig.json /
RUN npm run build && npm prune --omit=dev


FROM nginx:latest
ENV NODE_VERSION=22.12.0

RUN apt-get update \
 && apt-get install openssh-server bash -y \
 && rm -rf /var/cache/apt/archives /var/lib/apt/lists/*

ADD https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh /install-nvm.sh
RUN bash /install-nvm.sh \
 && . /root/.nvm/nvm.sh \
 && nvm install $NODE_VERSION \
 && rm -r /install-nvm.sh /root/.nvm /usr/bin/.cache

ENV PATH="/usr/bin/versions/node/v${NODE_VERSION}/bin/:${PATH}"

COPY --from=frontend /build/public /usr/share/nginx/html

WORKDIR /app

COPY --from=backend /build/dist ./dist
COPY --from=backend /build/node_modules ./node_modules
COPY --from=backend /build/run.sh ./

COPY --from=backend /build/nginx.conf /etc/nginx/conf.d/default.conf

CMD ["/app/run.sh"]
