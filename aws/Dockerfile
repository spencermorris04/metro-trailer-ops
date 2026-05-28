FROM public.ecr.aws/docker/library/node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
COPY aws ./aws
COPY business-central ./business-central
COPY record360 ./record360
COPY sharepoint ./sharepoint
COPY skybitz ./skybitz
COPY orbcomm ./orbcomm
COPY telematics ./telematics

ENTRYPOINT ["npx", "tsx", "aws/worker/sync-worker.ts"]
