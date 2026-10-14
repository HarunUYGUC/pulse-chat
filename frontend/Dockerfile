# Stage 1: Build React/Vite SPA
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (utilizing layer caching)
COPY package*.json ./
RUN npm install

# Copy source and build static bundle
COPY . ./
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine AS final

# Replace default Nginx configuration with our custom reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production build artifacts from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
